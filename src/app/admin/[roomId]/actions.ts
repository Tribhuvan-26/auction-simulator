'use server'

import type { AuctionLot, Prisma } from '@prisma/client'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitAuctionEvent } from '@/lib/socket-emitter'
import type { LiveEvent } from '@/lib/live-events'
import { activeBidders, bidRejectionReason, getNextBidAmount, isOnLadder, type BidTeam } from '@/lib/bid-rules'
import { isUncapped, OVERSEAS_MAX, PURSE_TOTAL, ROLE_ORDER, SQUAD_SIZE, squadRejectionReason } from '@/lib/team-rules'
import { assertCanBidAs, assertIsAuctioneer } from '@/lib/team-auth'
import { formatMoney } from '@/lib/money'
import { TIMER_DEFAULT_SECONDS } from '@/lib/auction-constants'

// Upcoming order: the auctioneer's moves (queueOrder) first, then seed order.
const QUEUE_ORDER = [{ queueOrder: 'asc' as const }, { id: 'asc' as const }]

export type AdminSnapshot = {
  /** When the server read this state (ms) — orders snapshots that race. */
  at: number
  room: { id: string; name: string; phase: string; round: number }
  currentLot: {
    id: string
    lotNumber: number
    status: string
    currentBid: number
    currentBiddingTeamId: string | null
    timerSeconds: number
    /** Teams still contesting the lot, in the order they came in (two at most can bid). */
    activeBidders: string[]
    /** Teams that dropped out of this lot. */
    droppedTeamIds: string[]
    bidHistory: { teamId: string; teamName: string; amount: number; timestamp: string }[]
    player: {
      id: string; name: string; role: string; basePrice: number
      photoUrl: string | null; nationality: string; matches: number
      runs: number | null; wickets: number | null; average: number | null
      strikeRate: number | null; economy: number | null
      isOverseas: boolean; setNumber: string
    }
  } | null
  teams: {
    id: string; name: string; shortCode: string; colorAccent: string; logoUrl: string | null
    purseTotal: number; purseRemaining: number; squadCount: number; squadMax: number
    overseasSlotsUsed: number; overseasSlotsMax: number
    squad: { id: string; name: string; role: string; price: number; photoUrl: string | null; isOverseas: boolean; uncapped: boolean }[]
  }[]
  queue: { id: string; name: string; role: string; basePrice: number; setNumber: string; status: string; photoUrl: string | null }[]
  soldLog: { id: string; playerName: string; price: number; teamShortCode: string }[]
  /** Every closed lot in the room, newest first — feeds the display's ticker. */
  resultLog: {
    id: string; playerId: string; playerName: string; status: 'SOLD' | 'UNSOLD'
    price: number | null; teamShortCode: string | null; colorAccent: string | null
  }[]
}

/**
 * What the team seats and the big screen need. Same shape minus the queue,
 * which is every UPCOMING player — 254 rows at the start of an auction, re-sent
 * to every screen on every bid if it stays in. Only the auctioneer picks the
 * next lot, so only the auctioneer needs it.
 */
export type PublicSnapshot = Omit<AdminSnapshot, 'queue'>

const LOT_INCLUDE = { player: true, bids: { include: { team: true }, orderBy: { amount: 'asc' } } } as const
type LotRow = Prisma.AuctionLotGetPayload<{ include: typeof LOT_INCLUDE }>

function toLotView(lot: LotRow, lotCount: number, dropped: string[]): NonNullable<AdminSnapshot['currentLot']> {
  return {
  id: lot.id,
  lotNumber: lotCount,
  status: lot.status,
  currentBid: lot.currentBid,
  currentBiddingTeamId: lot.currentBiddingTeamId,
  timerSeconds: lot.timerSeconds,
  activeBidders: activeBidders(lot.bids.map((b) => b.teamId), dropped),
  droppedTeamIds: dropped,
  bidHistory: lot.bids.map((b) => ({
    teamId: b.teamId,
    teamName: b.team.name,
    amount: b.amount,
    timestamp: b.timestamp.toISOString(),
  })),
  player: {
    id: lot.player.id,
    name: lot.player.name,
    role: lot.player.role,
    basePrice: lot.player.basePrice,
    photoUrl: lot.player.photoUrl,
    nationality: lot.player.nationality,
    matches: lot.player.matches,
    runs: lot.player.runs,
    wickets: lot.player.wickets,
    average: lot.player.average,
    strikeRate: lot.player.strikeRate,
    economy: lot.player.economy,
    isOverseas: lot.player.isOverseas,
    setNumber: lot.player.setNumber,
  },
}
}

/** The DB's clock — see buildSnapshot for why it's stamped first. */
async function dbNow(): Promise<number> {
  const [{ at }] = await prisma.$queryRaw<{ at: number }[]>`
    SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS at`
  return at
}

/** What a bid changes: the lot on screen, nothing else. */
export type BidResult = { at: number; currentLot: PublicSnapshot['currentLot'] }

/**
 * A bid only moves the lot, so it reads just the lot — 4 small queries
 * instead of the whole room's teams, squads and history.
 */
async function buildLot(roomId: string): Promise<BidResult> {
  const at = await dbNow()
  const [lot, lotCount, dropped] = await Promise.all([
    prisma.auctionLot.findFirst({ where: { roomId }, include: LOT_INCLUDE, orderBy: { id: 'desc' } }),
    prisma.auctionLot.count({ where: { roomId } }),
    droppedTeams(roomId),
  ])
  return { at, currentLot: lot ? toLotView(lot, lotCount, dropped) : null }
}

async function buildSnapshot(roomId: string, includeQueue: boolean): Promise<AdminSnapshot> {
  // Stamped before the reads start, so a snapshot stamped later sees at least
  // as much. The DB's clock, not this server's: actions run on different
  // instances, and a few ms of skew between them could make screens drop a
  // newer update as stale.
  const at = await dbNow()
  // These reads are independent of each other, so they run in parallel (as far
  // as the pool allows). Each action builds this once and broadcasts it, so
  // the other screens don't each rebuild it.
  const [room, lot, lotCount, teamsRaw, queueRaw, soldRaw, resultsRaw, dropped] = await Promise.all([
    prisma.auctionRoom.findUniqueOrThrow({ where: { id: roomId } }),
    // Latest lot regardless of status, so a just-closed SOLD/UNSOLD lot stays visible
    // until the admin advances. cuid()s sort chronologically, so an active lot (newest) wins.
    prisma.auctionLot.findFirst({ where: { roomId }, include: LOT_INCLUDE, orderBy: { id: 'desc' } }),
    // Lot number is "how many lots this room has called", which is what the
    // status module shows — not the player's set name.
    prisma.auctionLot.count({ where: { roomId } }),
    prisma.team.findMany({
      where: { roomId },
      include: { players: true },
    }),
    includeQueue
      ? prisma.player.findMany({ where: { roomId, status: 'UPCOMING' }, orderBy: QUEUE_ORDER })
      : Promise.resolve([]),
    prisma.player.findMany({
      where: { roomId, status: 'SOLD' },
      include: { team: true },
      orderBy: { id: 'desc' },
      take: 12,
    }),
    // ponytail: whole history, no cap — ~250 lots of a few short fields at most.
    prisma.auctionLot.findMany({
      where: { roomId, status: { in: ['SOLD', 'UNSOLD'] } },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        status: true,
        player: { select: { id: true, name: true, soldPrice: true, team: { select: { shortCode: true, colorAccent: true } } } },
      },
    }),
    droppedTeams(roomId),
  ])

  return {
    at,
    room: { id: room.id, name: room.name, phase: room.phase, round: room.round },
    currentLot: lot ? toLotView(lot, lotCount, dropped) : null,
    teams: teamsRaw.map((t) => ({
      id: t.id,
      name: t.name,
      shortCode: t.shortCode,
      colorAccent: t.colorAccent,
      logoUrl: t.logoUrl,
      purseTotal: t.purseTotal,
      purseRemaining: t.purseRemaining,
      squadCount: t.players.length,
      squadMax: t.squadMax,
      overseasSlotsUsed: t.overseasSlotsUsed,
      overseasSlotsMax: t.overseasSlotsMax,
      squad: t.players.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        price: p.soldPrice ?? 0,
        photoUrl: p.photoUrl,
        isOverseas: p.isOverseas,
        uncapped: isUncapped(p.setNumber),
      })),
    })),
    queue: queueRaw.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      basePrice: p.basePrice,
      setNumber: p.setNumber,
      status: p.status,
      photoUrl: p.photoUrl,
    })),
    soldLog: soldRaw.map((p) => ({
      id: p.id,
      playerName: p.name,
      price: p.soldPrice ?? 0,
      teamShortCode: p.team?.shortCode ?? '',
    })),
    resultLog: resultsRaw.map((l) => ({
      id: l.id,
      playerId: l.player.id,
      playerName: l.player.name,
      status: l.status as 'SOLD' | 'UNSOLD',
      price: l.player.soldPrice,
      teamShortCode: l.player.team?.shortCode ?? null,
      colorAccent: l.player.team?.colorAccent ?? null,
    })),
  }
}

// Every export of a 'use server' file is a public POST endpoint, so the queue
// (the auctioneer's running order) needs the same guard as the mutations.
export async function getAdminSnapshot(roomId: string): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)
  return buildSnapshot(roomId, true)
}

export async function getPublicSnapshot(roomId: string): Promise<PublicSnapshot> {
  return toPublic(await buildSnapshot(roomId, false))
}

function toPublic({ queue: _queue, ...rest }: AdminSnapshot): PublicSnapshot {
  void _queue
  return rest
}

/**
 * Tell every screen in the room, after the response has gone back to whoever
 * clicked — the acting user never waits on Supabase. Outside a request (tests,
 * scripts) `after` throws, so it just sends straight away.
 */
function publish(roomId: string, event: LiveEvent) {
  const send = () => emitAuctionEvent(roomId, event)
  try {
    after(send)
  } catch {
    void send()
  }
}

/** Broadcast a change that may touch more than the lot, and hand back the admin view. */
async function publishSnapshot(roomId: string, type: Exclude<LiveEvent['type'], 'BID' | 'REPLAY'>): Promise<AdminSnapshot> {
  const snapshot = await buildSnapshot(roomId, true)
  publish(roomId, { type, at: snapshot.at, snapshot: toPublic(snapshot) })
  return snapshot
}

/** Bid amounts only move while the room is running — PAUSE and END mean stop. */
function assertRoomOpen(phase: string) {
  if (phase === 'PAUSED') throw new Error('Auction is paused — the auctioneer has to resume it')
  if (phase === 'COMPLETED') throw new Error('Auction has ended — the auctioneer can reopen it')
}

/** Broadcast a bid (only the lot moved) and return the state it produced. */
async function publishBid(roomId: string, teamId: string, amount: number): Promise<BidResult> {
  const result = await buildLot(roomId)
  publish(roomId, { type: 'BID', teamId, amount, at: result.at, lot: result.currentLot })
  return result
}

/**
 * The lot on the block. A closed lot is an ordinary state — the auctioneer has
 * just called it — so this reports that in words rather than letting Prisma's
 * "no record was found" surface in the console.
 */
async function openLotOrThrow(roomId: string) {
  const [lot, dropped] = await Promise.all([
    prisma.auctionLot.findFirst({
      where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
      include: {
        player: true,
        room: { select: { phase: true } },
        bids: { select: { teamId: true }, orderBy: { amount: 'asc' } },
      },
      orderBy: { id: 'desc' },
    }),
    droppedTeams(roomId),
  ])
  if (!lot) throw new Error('No lot on the block — load the next player first')
  return { ...lot, droppedTeamIds: dropped }
}

/**
 * Teams that dropped out of the room's newest lot (the one on screen). Raw SQL
 * because the column may not exist yet on an older database — then nobody has
 * dropped, and the two-team lock still works, just without DROP.
 */
async function droppedTeams(roomId: string): Promise<string[]> {
  try {
    const rows = await prisma.$queryRaw<{ d: string[] }[]>`
      SELECT "droppedTeamIds" AS d FROM "AuctionLot" WHERE "roomId" = ${roomId} ORDER BY id DESC LIMIT 1`
    return rows[0]?.d ?? []
  } catch {
    return []
  }
}

type OpenLot = Awaited<ReturnType<typeof openLotOrThrow>>

/** The lot as the bid rules see it. */
function bidLot(lot: OpenLot) {
  return {
    currentBid: lot.currentBid,
    status: lot.status,
    player: lot.player,
    activeBidders: activeBidders(lot.bids.map((b) => b.teamId), lot.droppedTeamIds),
    droppedTeamIds: lot.droppedTeamIds,
  }
}

/**
 * A team as the bid rules see it, with its squad. Scoped to the room: a
 * teamId from another room must not be able to bid on this lot, or markSold
 * would debit a purse in a different auction entirely.
 */
async function bidTeam(roomId: string, teamId: string): Promise<BidTeam & { shortCode: string }> {
  const team = await prisma.team.findFirstOrThrow({
    where: { id: teamId, roomId },
    include: { players: { select: { name: true, role: true, isOverseas: true, setNumber: true } } },
  })
  return {
    ...team,
    squad: team.players.map((p) => ({ ...p, uncapped: isUncapped(p.setNumber) })),
  }
}

/**
 * Where-clause that only matches the lot if nothing has touched it since it was
 * read. Every write that depends on the lot's state goes through this, then
 * checks `count`: a double-click or a racing bid finds count 0 and stops
 * instead of applying twice.
 */
function lotUnchanged(lot: Pick<AuctionLot, 'id' | 'status' | 'currentBid' | 'currentBiddingTeamId'>) {
  return {
    id: lot.id,
    status: lot.status,
    currentBid: lot.currentBid,
    currentBiddingTeamId: lot.currentBiddingTeamId,
  }
}

// Prisma's default gives an interactive transaction 5s, counted from BEGIN.
// These do 2–4 small writes, but a slow moment (a cold function, a burst of
// requests, a dev recompile) shouldn't make the hammer fail mid-auction.
const TX = { maxWait: 10_000, timeout: 15_000 }

/**
 * The live database allows one bid per amount on a lot (Bid_lotId_amount_key),
 * so re-bidding an amount already in the history — after an undo, or a jump
 * bid typed to a number someone already called — reads as Prisma's raw P2002
 * unless it's put in words here.
 */
async function createBid(tx: Prisma.TransactionClient, data: { lotId: string; teamId: string; amount: number }) {
  try {
    await tx.bid.create({ data })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      throw new Error(`${formatMoney(data.amount)} was already bid on this lot — bid higher`)
    }
    throw e
  }
}

const LOT_CHANGED = 'The lot changed while you were acting on it — check the latest state and try again'

/**
 * Returns the public snapshot, not the admin one: team seats call this too,
 * and the queue isn't theirs to see. A bid never changes the queue, so the
 * admin console keeps the one it already has.
 */
export async function placeBid(roomId: string, teamId: string, amount: number): Promise<BidResult> {
  // Server Actions are POST endpoints — the PIN gate on the page stops nobody
  // who crafts the request by hand. Authorise before touching the database.
  await assertCanBidAs(roomId, teamId)

  // Independent reads, so together: every round trip here is time a bid
  // spends waiting while the other team can still get in first.
  const [lot, team] = await Promise.all([openLotOrThrow(roomId), bidTeam(roomId, teamId)])
  assertRoomOpen(lot.room.phase)
  if (lot.currentBiddingTeamId === teamId) throw new Error('You already hold the highest bid')

  // The ladder allows exactly one next amount, so don't take the client's word
  // for it — recompute and reject anything that doesn't match. A lot that
  // hasn't opened yet is bid at its current (base) price; once it's BIDDING the
  // raise has to be the tier increment.
  const expected =
    lot.status === 'BIDDING' ? getNextBidAmount(lot.currentBid, lot.player.basePrice) : lot.currentBid
  if (amount !== expected) {
    // Almost always a screen a moment behind: someone else bid first.
    throw new Error(`Price moved — the next bid is ${formatMoney(expected)}, press BID again`)
  }

  // Trust boundary: team consoles are untrusted clients, so re-check here even
  // though the BID button is already disabled with the same reason. This is
  // also where the first two teams in lock the lot until one of them drops.
  const rejection = bidRejectionReason(team, bidLot(lot), amount)
  if (rejection) throw new Error(rejection)

  // Optimistic concurrency: the lot only moves if it is still exactly as this
  // bid saw it — same price, same leader, still open. Two bids arriving
  // together both pass the checks above; this is where the slower one loses,
  // and a bid racing the hammer can't reopen a lot that was just sold.
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.auctionLot.updateMany({
      where: lotUnchanged(lot),
      data: { currentBid: amount, currentBiddingTeamId: teamId, status: 'BIDDING' },
    })
    if (count === 0) throw new Error('Bid already updated by another team')
    await createBid(tx, { lotId: lot.id, teamId, amount })
  }, TX)

  return publishBid(roomId, teamId, amount)
}

/**
 * Auctioneer's jump bid: any amount further up the ladder, for any team. Every
 * bid must still land on a valid increment, and the team must be allowed to
 * buy the player — same rules as a team's own bid, two-team lock included.
 */
export async function forceBid(roomId: string, teamId: string, amount: number): Promise<BidResult> {
  await assertIsAuctioneer(roomId)
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Bid must be a whole number of lakhs above zero')

  const [lot, team] = await Promise.all([openLotOrThrow(roomId), bidTeam(roomId, teamId)])
  assertRoomOpen(lot.room.phase)
  // Below the price is a typo that would hand a player over cheaper than the
  // room already bid.
  if (lot.status === 'BIDDING' ? amount <= lot.currentBid : amount < lot.currentBid) {
    throw new Error(`Jump bid must be above the current ${formatMoney(lot.currentBid)}`)
  }
  if (!isOnLadder(amount, lot.player.basePrice)) {
    throw new Error(`${formatMoney(amount)} isn't a valid increment — bids go up in ladder steps`)
  }
  if (lot.currentBiddingTeamId === teamId) throw new Error('That team already holds the highest bid')
  const rejection = bidRejectionReason(team, bidLot(lot), amount)
  if (rejection) throw new Error(`${team.shortCode}: ${rejection}`)

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.auctionLot.updateMany({
      where: lotUnchanged(lot),
      data: { currentBid: amount, currentBiddingTeamId: team.id, status: 'BIDDING' },
    })
    if (count === 0) throw new Error('Bid already updated by another team')
    await createBid(tx, { lotId: lot.id, teamId: team.id, amount })
  }, TX)

  return publishBid(roomId, team.id, amount)
}

export async function markSold(roomId: string): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  const lot = await openLotOrThrow(roomId)
  const winnerId = lot.currentBiddingTeamId
  if (!winnerId) throw new Error('Cannot mark sold with no bidding team')

  // Bids are checked as they come in, but a squad can change under a bid
  // (an undo elsewhere, a lot sold in between), so the sale checks again.
  const winner = await bidTeam(roomId, winnerId)
  if (winner.purseRemaining < lot.currentBid) {
    throw new Error(`${winner.shortCode} cannot afford ${formatMoney(lot.currentBid)}`)
  }
  const squadRule = squadRejectionReason(
    winner.squad,
    { role: lot.player.role, isOverseas: lot.player.isOverseas, uncapped: isUncapped(lot.player.setNumber) },
    { squadMax: winner.squadMax, overseasMax: winner.overseasSlotsMax }
  )
  if (squadRule) throw new Error(`${winner.shortCode}: ${squadRule}`)

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.auctionLot.updateMany({ where: lotUnchanged(lot), data: { status: 'SOLD' } })
    if (count === 0) throw new Error(LOT_CHANGED)
    await tx.player.update({
      where: { id: lot.playerId },
      data: { status: 'SOLD', teamId: winnerId, soldPrice: lot.currentBid },
    })
    await tx.team.update({
      where: { id: winnerId },
      data: {
        purseRemaining: { decrement: lot.currentBid },
        overseasSlotsUsed: { increment: lot.player.isOverseas ? 1 : 0 },
      },
    })
  }, TX)

  return publishSnapshot(roomId, 'SOLD')
}

export async function markUnsold(roomId: string): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  const lot = await openLotOrThrow(roomId)
  if (lot.currentBiddingTeamId) throw new Error('Cannot mark unsold once a team has bid — undo the bid first')

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.auctionLot.updateMany({ where: lotUnchanged(lot), data: { status: 'UNSOLD' } })
    if (count === 0) throw new Error(LOT_CHANGED)
    await tx.player.update({ where: { id: lot.playerId }, data: { status: 'UNSOLD' } })
  }, TX)

  return publishSnapshot(roomId, 'UNSOLD')
}

/**
 * A team leaves the lot. Two teams contest a lot at a time, so this is what
 * lets a third one in; the team that dropped can't come back to this lot.
 * The team holding the highest bid can't drop — the auctioneer sells to it.
 */
export async function dropFromLot(roomId: string, teamId: string): Promise<PublicSnapshot> {
  await assertCanBidAs(roomId, teamId)
  const lot = await openLotOrThrow(roomId)
  if (lot.currentBiddingTeamId === teamId) throw new Error('You hold the highest bid — you can only drop once outbid')
  if (lot.droppedTeamIds.includes(teamId)) return toPublic(await buildSnapshot(roomId, false))
  await prisma.team.findFirstOrThrow({ where: { id: teamId, roomId }, select: { id: true } })

  // Same guard as lotUnchanged: only if nothing moved since it was read.
  let count: number
  try {
    count = await prisma.$executeRaw`
      UPDATE "AuctionLot" SET "droppedTeamIds" = array_append("droppedTeamIds", ${teamId})
      WHERE id = ${lot.id} AND status::text = ${lot.status} AND "currentBid" = ${lot.currentBid}
        AND "currentBiddingTeamId" IS NOT DISTINCT FROM ${lot.currentBiddingTeamId}`
  } catch {
    throw new Error('DROP needs a database update — run migration 20261030090000_lot_dropped_teams')
  }
  if (count === 0) throw new Error(LOT_CHANGED)
  return toPublic(await publishSnapshot(roomId, 'DROP'))
}

/**
 * Play the sold animation again on every screen. Only for the lot on screen,
 * and only once it's sold — there's nothing to celebrate otherwise.
 */
export async function replaySold(roomId: string): Promise<void> {
  await assertIsAuctioneer(roomId)
  const lot = await prisma.auctionLot.findFirst({
    where: { roomId },
    select: { id: true, status: true },
    orderBy: { id: 'desc' },
  })
  if (lot?.status !== 'SOLD') throw new Error('Only a sold player can be replayed')
  publish(roomId, { type: 'REPLAY', at: Date.now(), lotId: lot.id })
}

export async function undoLastBid(roomId: string): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  // Undo walks back one step of whatever just happened, so it looks at the
  // newest lot in the room regardless of status: calling a lot sold or unsold
  // is the most likely thing to want back.
  const lot = await prisma.auctionLot.findFirst({
    where: { roomId },
    include: { player: true },
    orderBy: { id: 'desc' },
  })
  if (!lot) return buildSnapshot(roomId, true)

  if (lot.status === 'SOLD' && lot.currentBiddingTeamId) {
    // Put the money back, free the squad and overseas slot, and return the lot
    // to the block with its bid ladder intact.
    const winnerId = lot.currentBiddingTeamId
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.auctionLot.updateMany({ where: lotUnchanged(lot), data: { status: 'BIDDING' } })
      if (count === 0) throw new Error(LOT_CHANGED)
      await tx.team.update({
        where: { id: winnerId },
        data: {
          purseRemaining: { increment: lot.currentBid },
          overseasSlotsUsed: { decrement: lot.player.isOverseas ? 1 : 0 },
        },
      })
      await tx.player.update({
        where: { id: lot.playerId },
        data: { status: 'LIVE', teamId: null, soldPrice: null },
      })
    }, TX)
    return publishSnapshot(roomId, 'UNDO')
  }

  if (lot.status === 'UNSOLD') {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.auctionLot.updateMany({
        where: lotUnchanged(lot),
        data: { status: lot.currentBiddingTeamId ? 'BIDDING' : 'QUEUED' },
      })
      if (count === 0) throw new Error(LOT_CHANGED)
      await tx.player.update({ where: { id: lot.playerId }, data: { status: 'LIVE' } })
    }, TX)
    return publishSnapshot(roomId, 'UNDO')
  }

  const lastBid = await prisma.bid.findFirst({ where: { lotId: lot.id }, orderBy: { amount: 'desc' } })
  if (!lastBid) return buildSnapshot(roomId, true)

  const remaining = await prisma.bid.findMany({
    where: { lotId: lot.id, id: { not: lastBid.id } },
    orderBy: { amount: 'desc' },
  })
  const newHead = remaining[0]

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.auctionLot.updateMany({
      where: lotUnchanged(lot),
      data: {
        currentBid: newHead ? newHead.amount : lot.player.basePrice,
        currentBiddingTeamId: newHead ? newHead.teamId : null,
        status: newHead ? 'BIDDING' : 'QUEUED',
      },
    })
    if (count === 0) throw new Error(LOT_CHANGED)
    await tx.bid.delete({ where: { id: lastBid.id } })
  }, TX)

  return publishSnapshot(roomId, 'UNDO')
}

export async function controlTimer(
  roomId: string,
  action: 'reset' | 'add10'
): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  const lot = await openLotOrThrow(roomId)

  const timerSeconds = action === 'reset' ? TIMER_DEFAULT_SECONDS : lot.timerSeconds + 10

  await prisma.auctionLot.update({ where: { id: lot.id }, data: { timerSeconds } })
  return publishSnapshot(roomId, 'TIMER')
}

export async function setPhase(
  roomId: string,
  phase: 'LIVE' | 'PAUSED' | 'COMPLETED'
): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  await prisma.auctionRoom.update({ where: { id: roomId }, data: { phase } })
  return publishSnapshot(roomId, 'PHASE')
}

/**
 * Starts the room over once its auction has ended: every purse back to 100 Cr,
 * every squad empty, every player back in the queue in role order. The room
 * code, teams and PINs stay. Only from an ended room, so a stray click can't
 * wipe an auction that's running.
 */
export async function restartRoom(roomId: string): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)
  await prisma.$transaction(async (tx) => {
    const [room] = await tx.$queryRaw<{ phase: string }[]>`
      SELECT phase::text FROM "AuctionRoom" WHERE id = ${roomId} FOR UPDATE`
    if (room?.phase !== 'COMPLETED') throw new Error('End the auction before starting a new one')
    await tx.bid.deleteMany({ where: { lot: { roomId } } })
    await tx.auctionLot.deleteMany({ where: { roomId } })
    await tx.player.updateMany({ where: { roomId }, data: { status: 'UPCOMING', teamId: null, soldPrice: null } })
    // Role order (batters, bowlers, all-rounders, keepers), keeping the
    // existing order within each role.
    await tx.$executeRaw`
      UPDATE "Player" p SET "queueOrder" = o.rn
      FROM (
        SELECT id, (row_number() OVER (ORDER BY
          CASE role WHEN 'BATTER' THEN 0 WHEN 'BOWLER' THEN 1 WHEN 'ALL_ROUNDER' THEN 2 ELSE 3 END,
          "queueOrder", id) - 1)::int AS rn
        FROM "Player" WHERE "roomId" = ${roomId}
      ) o
      WHERE p.id = o.id`
    await tx.team.updateMany({
      where: { roomId },
      data: {
        purseTotal: PURSE_TOTAL,
        purseRemaining: PURSE_TOTAL,
        squadMax: SQUAD_SIZE,
        squadMin: SQUAD_SIZE - 1,
        overseasSlotsMax: OVERSEAS_MAX,
        overseasSlotsUsed: 0,
      },
    })
    await tx.auctionRoom.update({ where: { id: roomId }, data: { phase: 'SETUP', round: 1 } })
  }, TX)
  return publishSnapshot(roomId, 'PHASE')
}

/**
 * Once the queue runs dry, the unsold players come back for another round —
 * while some team still has slots to fill. In the auction's role order:
 * batters, bowlers, all-rounders, then keepers. Returns whether anyone came back.
 */
async function requeueUnsold(tx: Prisma.TransactionClient, roomId: string): Promise<boolean> {
  const teams = await tx.team.findMany({ where: { roomId }, select: { squadMax: true, _count: { select: { players: true } } } })
  const someoneShort = teams.some((t) => t._count.players < t.squadMax)
  if (!someoneShort) return false

  const unsold = await tx.player.findMany({ where: { roomId, status: 'UNSOLD' }, orderBy: QUEUE_ORDER })
  if (unsold.length === 0) return false
  const ids = unsold.map((p) => p.id)
  // One lot per player, so the old lot goes — its bids first.
  await tx.bid.deleteMany({ where: { lot: { playerId: { in: ids } } } })
  await tx.auctionLot.deleteMany({ where: { playerId: { in: ids } } })
  const ordered = [...unsold].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
  for (const [i, p] of ordered.entries()) {
    await tx.player.update({ where: { id: p.id }, data: { status: 'UPCOMING', queueOrder: i } })
  }
  await tx.auctionRoom.update({ where: { id: roomId }, data: { round: { increment: 1 } } })
  return true
}

export async function advanceToNextLot(roomId: string): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  // A lot already on the block must be closed (SOLD/UNSOLD) before the next
  // one opens — otherwise two lots end up QUEUED/BIDDING at once and every
  // other action here (which all query "the" active lot) starts resolving
  // the wrong one. The room row is locked first so two clicks can't both
  // pass the check — the second waits, then finds the first one's lot.
  let opened: string | null = null
  let nothingLeft = false
  try {
    opened = await prisma.$transaction(async (tx) => {
      const [room] = await tx.$queryRaw<{ phase: string }[]>`
        SELECT phase::text FROM "AuctionRoom" WHERE id = ${roomId} FOR UPDATE`
      const alreadyActive = await tx.auctionLot.findFirst({
        where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
        select: { id: true },
      })
      if (alreadyActive) return null

      let next = await tx.player.findFirst({ where: { roomId, status: 'UPCOMING' }, orderBy: QUEUE_ORDER })
      if (!next && (await requeueUnsold(tx, roomId))) {
        next = await tx.player.findFirst({ where: { roomId, status: 'UPCOMING' }, orderBy: QUEUE_ORDER })
      }
      if (!next) {
        nothingLeft = true
        return null
      }

      await tx.player.update({ where: { id: next.id }, data: { status: 'LIVE' } })
      // Rooms are seeded in SETUP; calling the first lot is what starts the
      // auction. Calling the next player after END AUCTION means the auctioneer
      // is carrying on, so it reopens the room rather than refusing.
      if (room?.phase === 'SETUP' || room?.phase === 'COMPLETED') {
        await tx.auctionRoom.update({ where: { id: roomId }, data: { phase: 'LIVE' } })
      }
      await tx.auctionLot.create({
        data: {
          roomId,
          playerId: next.id,
          currentBid: next.basePrice,
          status: 'QUEUED',
          timerSeconds: TIMER_DEFAULT_SECONDS,
        },
      })
      return next.id
    }, TX)
  } catch (e) {
    // A double-click already opened this same player (one lot per player), so
    // the first click won and there is nothing left to do.
    if ((e as { code?: string }).code !== 'P2002') throw e
  }

  if (nothingLeft) throw new Error('No players left to call — the queue is empty and no team needs the unsold players')
  return opened ? publishSnapshot(roomId, 'LOT_CHANGE') : buildSnapshot(roomId, true)
}

/**
 * Moves an UPCOMING player to a 1-based spot in the queue (1 = up next) by
 * renumbering the whole queue — it's only ~100 rows.
 */
export async function moveInQueue(roomId: string, playerId: string, position: number): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)
  const queue = await prisma.player.findMany({
    where: { roomId, status: 'UPCOMING' },
    orderBy: QUEUE_ORDER,
    select: { id: true },
  })
  const ids = queue.map((p) => p.id)
  if (!ids.includes(playerId)) throw new Error('That player is no longer in the queue')
  const at = Math.min(Math.max(Math.trunc(position) || 1, 1), ids.length) - 1
  const next = ids.filter((id) => id !== playerId)
  next.splice(at, 0, playerId)
  await prisma.$transaction(
    next.map((id, i) => prisma.player.update({ where: { id }, data: { queueOrder: i } }))
  )
  return buildSnapshot(roomId, true)
}

export async function getRoomPlayers(roomId: string) {
  return prisma.player.findMany({
    where: { roomId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      role: true,
      basePrice: true,
      photoUrl: true,
      nationality: true,
      matches: true,
      runs: true,
      wickets: true,
      average: true,
      strikeRate: true,
      economy: true,
      isOverseas: true,
      setNumber: true,
      status: true,
      soldPrice: true,
      team: {
        select: {
          id: true,
          name: true,
          shortCode: true,
          colorAccent: true,
        },
      },
    },
  })
}

export type RoomPlayerItem = Awaited<ReturnType<typeof getRoomPlayers>>[number]
