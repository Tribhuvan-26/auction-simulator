'use server'

import type { AuctionLot, Prisma } from '@prisma/client'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitAuctionEvent } from '@/lib/socket-emitter'
import type { LiveEvent } from '@/lib/live-events'
import { bidRejectionReason, getNextBidAmount } from '@/lib/bid-rules'
import { assertCanBidAs, assertIsAuctioneer, hasAdminAccess } from '@/lib/team-auth'
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
    squad: { id: string; name: string; role: string; price: number; photoUrl: string | null; isOverseas: boolean }[]
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

async function buildSnapshot(roomId: string, includeQueue: boolean): Promise<AdminSnapshot> {
  // Stamped before the reads start, so a snapshot stamped later sees at least
  // as much. The DB's clock, not this server's: actions run on different
  // instances, and a few ms of skew between them could make screens drop a
  // newer update as stale.
  const [{ at }] = await prisma.$queryRaw<{ at: number }[]>`
    SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS at`
  // These reads are independent of each other, so they run in parallel (as far
  // as the pool allows). Each action builds this once and broadcasts it, so
  // the other screens don't each rebuild it.
  const [room, lot, lotCount, teamsRaw, queueRaw, soldRaw, resultsRaw] = await Promise.all([
    prisma.auctionRoom.findUniqueOrThrow({ where: { id: roomId } }),
    // Latest lot regardless of status, so a just-closed SOLD/UNSOLD lot stays visible
    // until the admin advances. cuid()s sort chronologically, so an active lot (newest) wins.
    prisma.auctionLot.findFirst({
      where: { roomId },
      include: { player: true, bids: { include: { team: true }, orderBy: { timestamp: 'asc' } } },
      orderBy: { id: 'desc' },
    }),
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
  ])

  return {
    at,
    room: { id: room.id, name: room.name, phase: room.phase, round: room.round },
    currentLot: lot
      ? {
          id: lot.id,
          lotNumber: lotCount,
          status: lot.status,
          currentBid: lot.currentBid,
          currentBiddingTeamId: lot.currentBiddingTeamId,
          timerSeconds: lot.timerSeconds,
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
      : null,
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
async function publishSnapshot(roomId: string, type: Exclude<LiveEvent['type'], 'BID'>): Promise<AdminSnapshot> {
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
async function publishBid(roomId: string, teamId: string, amount: number, includeQueue: boolean) {
  const snapshot = await buildSnapshot(roomId, includeQueue)
  publish(roomId, { type: 'BID', teamId, amount, at: snapshot.at, lot: snapshot.currentLot })
  return snapshot
}

/**
 * The lot on the block. A closed lot is an ordinary state — the auctioneer has
 * just called it — so this reports that in words rather than letting Prisma's
 * "no record was found" surface in the console.
 */
async function openLotOrThrow(roomId: string) {
  const lot = await prisma.auctionLot.findFirst({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
    include: { player: true, room: { select: { phase: true } } },
    orderBy: { id: 'desc' },
  })
  if (!lot) throw new Error('No lot on the block — load the next player first')
  return lot
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
export async function placeBid(roomId: string, teamId: string, amount: number): Promise<PublicSnapshot> {
  // Server Actions are POST endpoints — the PIN gate on the page stops nobody
  // who crafts the request by hand. Authorise before touching the database.
  await assertCanBidAs(roomId, teamId)

  const lot = await openLotOrThrow(roomId)
  assertRoomOpen(lot.room.phase)
  if (lot.currentBiddingTeamId === teamId) throw new Error('You already hold the highest bid')
  // Team seats only open the bidding; the room raises it from there and the
  // auctioneer keys each call in (forceBid / the admin's team tracker).
  if (lot.status === 'BIDDING' && !(await hasAdminAccess(roomId))) {
    throw new Error('Opening bid is in — the auctioneer takes it from here')
  }
  // Scoped to the room: a teamId from another room must not be able to bid on
  // this lot, or markSold would debit a purse in a different auction entirely.
  const team = await prisma.team.findFirstOrThrow({
    where: { id: teamId, roomId },
    include: { _count: { select: { players: true } } },
  })

  // The ladder allows exactly one next amount, so don't take the client's word
  // for it — recompute and reject anything that doesn't match. A lot that
  // hasn't opened yet is bid at its current (base) price; once it's BIDDING the
  // raise has to be the tier increment.
  const expected =
    lot.status === 'BIDDING' ? getNextBidAmount(lot.currentBid, lot.player.basePrice) : lot.currentBid
  if (amount !== expected) {
    throw new Error(`Off-tier bid: the next bid is ${formatMoney(expected)}, not ${formatMoney(amount)}`)
  }

  // Trust boundary: team consoles are untrusted clients, so re-check here even
  // though the BID button is already disabled with the same reason.
  const rejection = bidRejectionReason(
    { ...team, squadCount: team._count.players },
    { currentBid: lot.currentBid, status: lot.status, player: lot.player },
    amount
  )
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

  return toPublic(await publishBid(roomId, teamId, amount, false))
}

/**
 * Auctioneer-only override: sets the lot to any amount for any team, skipping
 * the tier ladder and the purse/squad/overseas checks placeBid enforces for
 * team seats. Used by the admin console's Jump Bid — the auctioneer calling
 * out a number is the source of truth, not the ladder.
 */
export async function forceBid(roomId: string, teamId: string, amount: number): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Bid must be a whole number of lakhs above zero')

  const lot = await openLotOrThrow(roomId)
  assertRoomOpen(lot.room.phase)
  // Off the ladder is fine; below the price is a typo that would hand a
  // player over cheaper than the room already bid.
  if (lot.status === 'BIDDING' ? amount <= lot.currentBid : amount < lot.currentBid) {
    throw new Error(`Jump bid must be above the current ${formatMoney(lot.currentBid)}`)
  }
  const team = await prisma.team.findFirstOrThrow({ where: { id: teamId, roomId } })

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.auctionLot.updateMany({
      where: lotUnchanged(lot),
      data: { currentBid: amount, currentBiddingTeamId: team.id, status: 'BIDDING' },
    })
    if (count === 0) throw new Error('Bid already updated by another team')
    await createBid(tx, { lotId: lot.id, teamId: team.id, amount })
  }, TX)

  return publishBid(roomId, team.id, amount, true)
}

export async function markSold(roomId: string): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  const lot = await openLotOrThrow(roomId)
  const winnerId = lot.currentBiddingTeamId
  if (!winnerId) throw new Error('Cannot mark sold with no bidding team')

  // Jump Bid skips the purse/squad checks, so the sale itself is where an
  // overdrawn purse or an over-full squad gets stopped.
  const winner = await prisma.team.findUniqueOrThrow({
    where: { id: winnerId },
    include: { _count: { select: { players: true } } },
  })
  if (winner.purseRemaining < lot.currentBid) {
    throw new Error(`${winner.shortCode} cannot afford ${formatMoney(lot.currentBid)}`)
  }
  if (winner._count.players >= winner.squadMax) throw new Error(`${winner.shortCode} squad is full`)
  if (lot.player.isOverseas && winner.overseasSlotsUsed >= winner.overseasSlotsMax) {
    throw new Error(`${winner.shortCode} has no overseas slots left`)
  }

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

  const lastBid = await prisma.bid.findFirst({ where: { lotId: lot.id }, orderBy: { timestamp: 'desc' } })
  if (!lastBid) return buildSnapshot(roomId, true)

  const remaining = await prisma.bid.findMany({
    where: { lotId: lot.id, id: { not: lastBid.id } },
    orderBy: { timestamp: 'desc' },
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

export async function advanceToNextLot(roomId: string): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  // A lot already on the block must be closed (SOLD/UNSOLD) before the next
  // one opens — otherwise two lots end up QUEUED/BIDDING at once and every
  // other action here (which all query "the" active lot) starts resolving
  // the wrong one. The room row is locked first so two clicks can't both
  // pass the check — the second waits, then finds the first one's lot.
  let opened: string | null = null
  try {
    opened = await prisma.$transaction(async (tx) => {
      const [room] = await tx.$queryRaw<{ phase: string }[]>`
        SELECT phase::text FROM "AuctionRoom" WHERE id = ${roomId} FOR UPDATE`
      if (room?.phase === 'COMPLETED') throw new Error('Auction has ended — press [REOPEN] to continue')
      const alreadyActive = await tx.auctionLot.findFirst({
        where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
        select: { id: true },
      })
      if (alreadyActive) return null

      const next = await tx.player.findFirst({ where: { roomId, status: 'UPCOMING' }, orderBy: QUEUE_ORDER })
      if (!next) return null

      await tx.player.update({ where: { id: next.id }, data: { status: 'LIVE' } })
      // Rooms are seeded in SETUP; calling the first lot is what starts the auction.
      if (room?.phase === 'SETUP') await tx.auctionRoom.update({ where: { id: roomId }, data: { phase: 'LIVE' } })
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
