'use server'

import { prisma } from '@/lib/prisma'
import { emitAuctionEvent } from '@/lib/socket-emitter'
import { bidRejectionReason, getNextBidAmount } from '@/lib/bid-rules'
import { assertCanBidAs, assertIsAuctioneer } from '@/lib/team-auth'
import { formatMoney } from '@/lib/money'
import { TIMER_DEFAULT_SECONDS } from '@/lib/auction-constants'

export type AdminSnapshot = {
  room: { id: string; name: string; phase: string; round: number }
  currentLot: {
    id: string
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
    id: string; name: string; shortCode: string; colorAccent: string
    purseTotal: number; purseRemaining: number; squadCount: number; squadMax: number
    overseasSlotsUsed: number; overseasSlotsMax: number
    squad: { id: string; name: string; role: string; price: number }[]
  }[]
  queue: { id: string; name: string; role: string; basePrice: number; setNumber: string; status: string; photoUrl: string | null }[]
  soldLog: { id: string; playerName: string; price: number; teamShortCode: string }[]
}

/**
 * What the team seats and the big screen need. Same shape minus the queue,
 * which is every UPCOMING player — 254 rows at the start of an auction, re-sent
 * to every screen on every bid if it stays in. Only the auctioneer picks the
 * next lot, so only the auctioneer needs it.
 */
export type PublicSnapshot = Omit<AdminSnapshot, 'queue'>

async function buildSnapshot(roomId: string, includeQueue: boolean): Promise<AdminSnapshot> {
  const room = await prisma.auctionRoom.findUniqueOrThrow({ where: { id: roomId } })

  // Latest lot regardless of status, so a just-closed SOLD/UNSOLD lot stays visible
  // until the admin advances. cuid()s sort chronologically, so an active lot (newest) wins.
  const lot = await prisma.auctionLot.findFirst({
    where: { roomId },
    include: { player: true, bids: { include: { team: true }, orderBy: { timestamp: 'asc' } } },
    orderBy: { id: 'desc' },
  })

  const teamsRaw = await prisma.team.findMany({
    where: { roomId },
    include: { players: true },
  })

  const queueRaw = includeQueue
    ? await prisma.player.findMany({ where: { roomId, status: 'UPCOMING' }, orderBy: { id: 'asc' } })
    : []

  const soldRaw = await prisma.player.findMany({
    where: { roomId, status: 'SOLD' },
    include: { team: true },
    orderBy: { id: 'desc' },
    take: 12,
  })

  return {
    room: { id: room.id, name: room.name, phase: room.phase, round: room.round },
    currentLot: lot
      ? {
          id: lot.id,
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
      purseTotal: t.purseTotal,
      purseRemaining: t.purseRemaining,
      squadCount: t.players.length,
      squadMax: t.squadMax,
      overseasSlotsUsed: t.overseasSlotsUsed,
      overseasSlotsMax: t.overseasSlotsMax,
      squad: t.players.map((p) => ({ id: p.id, name: p.name, role: p.role, price: p.soldPrice ?? 0 })),
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
  }
}

export async function getAdminSnapshot(roomId: string): Promise<AdminSnapshot> {
  return buildSnapshot(roomId, true)
}

export async function getPublicSnapshot(roomId: string): Promise<PublicSnapshot> {
  const { queue: _queue, ...rest } = await buildSnapshot(roomId, false)
  void _queue
  return rest
}

/**
 * The lot on the block. A closed lot is an ordinary state — the auctioneer has
 * just called it — so this reports that in words rather than letting Prisma's
 * "no record was found" surface in the console.
 */
async function openLotOrThrow(roomId: string) {
  const lot = await prisma.auctionLot.findFirst({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
    include: { player: true },
    orderBy: { id: 'desc' },
  })
  if (!lot) throw new Error('No lot on the block — load the next player first')
  return lot
}

export async function placeBid(roomId: string, teamId: string, amount: number): Promise<AdminSnapshot> {
  // Server Actions are POST endpoints — the PIN gate on the page stops nobody
  // who crafts the request by hand. Authorise before touching the database.
  await assertCanBidAs(roomId, teamId)

  const lot = await openLotOrThrow(roomId)
  // Scoped to the room: a teamId from another room must not be able to bid on
  // this lot, or markSold would debit a purse in a different auction entirely.
  const team = await prisma.team.findFirstOrThrow({
    where: { id: teamId, roomId },
    include: { players: true },
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
    { ...team, squadCount: team.players.length },
    { currentBid: lot.currentBid, status: lot.status, player: lot.player },
    amount
  )
  if (rejection) throw new Error(rejection)

  // Optimistic concurrency: the lot only moves if it is still at the price this
  // bid was computed against. Two bids arriving together both pass the checks
  // above — this is where the slower one loses, instead of silently
  // overwriting the faster one at the same amount.
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.auctionLot.updateMany({
      where: { id: lot.id, currentBid: lot.currentBid },
      data: { currentBid: amount, currentBiddingTeamId: teamId, status: 'BIDDING' },
    })
    if (count === 0) throw new Error('Bid already updated by another team')
    await tx.bid.create({ data: { lotId: lot.id, teamId, amount } })
  })

  await emitAuctionEvent(roomId, { type: 'BID', teamId, amount })
  return getAdminSnapshot(roomId)
}

export async function markSold(roomId: string): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  const lot = await openLotOrThrow(roomId)
  if (!lot.currentBiddingTeamId) throw new Error('Cannot mark sold with no bidding team')

  await prisma.$transaction([
    prisma.auctionLot.update({ where: { id: lot.id }, data: { status: 'SOLD' } }),
    prisma.player.update({
      where: { id: lot.playerId },
      data: { status: 'SOLD', teamId: lot.currentBiddingTeamId, soldPrice: lot.currentBid },
    }),
    prisma.team.update({
      where: { id: lot.currentBiddingTeamId },
      data: {
        purseRemaining: { decrement: lot.currentBid },
        overseasSlotsUsed: { increment: lot.player.isOverseas ? 1 : 0 },
      },
    }),
  ])

  await emitAuctionEvent(roomId, { type: 'SOLD' })
  return getAdminSnapshot(roomId)
}

export async function markUnsold(roomId: string): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  const lot = await openLotOrThrow(roomId)

  await prisma.$transaction([
    prisma.auctionLot.update({ where: { id: lot.id }, data: { status: 'UNSOLD' } }),
    prisma.player.update({ where: { id: lot.playerId }, data: { status: 'UNSOLD' } }),
  ])

  await emitAuctionEvent(roomId, { type: 'UNSOLD' })
  return getAdminSnapshot(roomId)
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
  if (!lot) return getAdminSnapshot(roomId)

  if (lot.status === 'SOLD' && lot.currentBiddingTeamId) {
    // Put the money back, free the squad and overseas slot, and return the lot
    // to the block with its bid ladder intact.
    await prisma.$transaction([
      prisma.team.update({
        where: { id: lot.currentBiddingTeamId },
        data: {
          purseRemaining: { increment: lot.currentBid },
          overseasSlotsUsed: { decrement: lot.player.isOverseas ? 1 : 0 },
        },
      }),
      prisma.player.update({
        where: { id: lot.playerId },
        data: { status: 'LIVE', teamId: null, soldPrice: null },
      }),
      prisma.auctionLot.update({ where: { id: lot.id }, data: { status: 'BIDDING' } }),
    ])
    await emitAuctionEvent(roomId, { type: 'UNDO' })
    return getAdminSnapshot(roomId)
  }

  if (lot.status === 'UNSOLD') {
    await prisma.$transaction([
      prisma.player.update({ where: { id: lot.playerId }, data: { status: 'LIVE' } }),
      prisma.auctionLot.update({
        where: { id: lot.id },
        data: { status: lot.currentBiddingTeamId ? 'BIDDING' : 'QUEUED' },
      }),
    ])
    await emitAuctionEvent(roomId, { type: 'UNDO' })
    return getAdminSnapshot(roomId)
  }

  const lastBid = await prisma.bid.findFirst({ where: { lotId: lot.id }, orderBy: { timestamp: 'desc' } })
  if (!lastBid) return getAdminSnapshot(roomId)

  const remaining = await prisma.bid.findMany({
    where: { lotId: lot.id, id: { not: lastBid.id } },
    orderBy: { timestamp: 'desc' },
  })
  const newHead = remaining[0]

  await prisma.$transaction([
    prisma.bid.delete({ where: { id: lastBid.id } }),
    prisma.auctionLot.update({
      where: { id: lot.id },
      data: {
        currentBid: newHead ? newHead.amount : lot.player.basePrice,
        currentBiddingTeamId: newHead ? newHead.teamId : null,
        status: newHead ? 'BIDDING' : 'QUEUED',
      },
    }),
  ])

  await emitAuctionEvent(roomId, { type: 'UNDO' })
  return getAdminSnapshot(roomId)
}

export async function controlTimer(
  roomId: string,
  action: 'start' | 'pause' | 'reset' | 'add10'
): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  const lot = await openLotOrThrow(roomId)

  const timerSeconds =
    action === 'reset' ? TIMER_DEFAULT_SECONDS : action === 'add10' ? lot.timerSeconds + 10 : lot.timerSeconds

  await prisma.auctionLot.update({ where: { id: lot.id }, data: { timerSeconds } })
  await emitAuctionEvent(roomId, { type: 'TIMER', action, timerSeconds })
  return getAdminSnapshot(roomId)
}

export async function setPhase(
  roomId: string,
  phase: 'LIVE' | 'PAUSED' | 'COMPLETED'
): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  await prisma.auctionRoom.update({ where: { id: roomId }, data: { phase } })
  await emitAuctionEvent(roomId, { type: 'PHASE', phase })
  return getAdminSnapshot(roomId)
}

export async function advanceToNextLot(roomId: string): Promise<AdminSnapshot> {
  await assertIsAuctioneer(roomId)

  // A lot already on the block must be closed (SOLD/UNSOLD) before the next
  // one opens — otherwise two lots end up QUEUED/BIDDING at once and every
  // other action here (which all query "the" active lot) starts resolving
  // the wrong one.
  const alreadyActive = await prisma.auctionLot.findFirst({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
  })
  if (alreadyActive) return getAdminSnapshot(roomId)

  const next = await prisma.player.findFirst({ where: { roomId, status: 'UPCOMING' }, orderBy: { id: 'asc' } })
  if (!next) return getAdminSnapshot(roomId)

  await prisma.$transaction([
    prisma.player.update({ where: { id: next.id }, data: { status: 'LIVE' } }),
    prisma.auctionLot.create({
      data: {
        roomId,
        playerId: next.id,
        currentBid: next.basePrice,
        status: 'QUEUED',
        timerSeconds: TIMER_DEFAULT_SECONDS,
      },
    }),
  ])

  await emitAuctionEvent(roomId, { type: 'LOT_CHANGE', playerId: next.id })
  return getAdminSnapshot(roomId)
}
