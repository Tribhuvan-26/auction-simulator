'use server'

import { prisma } from '@/lib/prisma'
import { emitAuctionEvent } from '@/lib/socket-emitter'

export type AdminSnapshot = {
  room: { id: string; phase: string; round: number }
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
    }
  } | null
  teams: {
    id: string; name: string; shortCode: string; colorAccent: string
    purseRemaining: number; squadCount: number; squadMax: number
    overseasSlotsUsed: number; overseasSlotsMax: number
  }[]
  queue: { id: string; name: string; role: string; basePrice: number; setNumber: string; status: string }[]
}

export async function getAdminSnapshot(roomId: string): Promise<AdminSnapshot> {
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

  const queueRaw = await prisma.player.findMany({
    where: { roomId, status: 'UPCOMING' },
    orderBy: { id: 'asc' },
  })

  return {
    room: { id: room.id, phase: room.phase, round: room.round },
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
          },
        }
      : null,
    teams: teamsRaw.map((t) => ({
      id: t.id,
      name: t.name,
      shortCode: t.shortCode,
      colorAccent: t.colorAccent,
      purseRemaining: t.purseRemaining,
      squadCount: t.players.length,
      squadMax: t.squadMax,
      overseasSlotsUsed: t.overseasSlotsUsed,
      overseasSlotsMax: t.overseasSlotsMax,
    })),
    queue: queueRaw.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      basePrice: p.basePrice,
      setNumber: p.setNumber,
      status: p.status,
    })),
  }
}

export async function placeBid(roomId: string, teamId: string, amount: number): Promise<AdminSnapshot> {
  const lot = await prisma.auctionLot.findFirstOrThrow({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
  })

  await prisma.$transaction([
    prisma.bid.create({ data: { lotId: lot.id, teamId, amount } }),
    prisma.auctionLot.update({
      where: { id: lot.id },
      data: { currentBid: amount, currentBiddingTeamId: teamId, status: 'BIDDING' },
    }),
  ])

  await emitAuctionEvent(roomId, { type: 'BID', teamId, amount })
  return getAdminSnapshot(roomId)
}

export async function markSold(roomId: string): Promise<AdminSnapshot> {
  const lot = await prisma.auctionLot.findFirstOrThrow({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
  })
  if (!lot.currentBiddingTeamId) throw new Error('Cannot mark sold with no bidding team')

  await prisma.$transaction([
    prisma.auctionLot.update({ where: { id: lot.id }, data: { status: 'SOLD' } }),
    prisma.player.update({
      where: { id: lot.playerId },
      data: { status: 'SOLD', teamId: lot.currentBiddingTeamId, soldPrice: lot.currentBid },
    }),
    prisma.team.update({
      where: { id: lot.currentBiddingTeamId },
      data: { purseRemaining: { decrement: lot.currentBid } },
    }),
  ])

  await emitAuctionEvent(roomId, { type: 'SOLD' })
  return getAdminSnapshot(roomId)
}

export async function markUnsold(roomId: string): Promise<AdminSnapshot> {
  const lot = await prisma.auctionLot.findFirstOrThrow({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
  })

  await prisma.$transaction([
    prisma.auctionLot.update({ where: { id: lot.id }, data: { status: 'UNSOLD' } }),
    prisma.player.update({ where: { id: lot.playerId }, data: { status: 'UNSOLD' } }),
  ])

  await emitAuctionEvent(roomId, { type: 'UNSOLD' })
  return getAdminSnapshot(roomId)
}

export async function undoLastBid(roomId: string): Promise<AdminSnapshot> {
  const lot = await prisma.auctionLot.findFirstOrThrow({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
    include: { player: true },
  })

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
      },
    }),
  ])

  await emitAuctionEvent(roomId, { type: 'UNDO' })
  return getAdminSnapshot(roomId)
}

const TIMER_DEFAULT_SECONDS = 30

export async function controlTimer(
  roomId: string,
  action: 'start' | 'pause' | 'reset' | 'add10'
): Promise<AdminSnapshot> {
  const lot = await prisma.auctionLot.findFirstOrThrow({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
  })

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
  await prisma.auctionRoom.update({ where: { id: roomId }, data: { phase } })
  await emitAuctionEvent(roomId, { type: 'PHASE', phase })
  return getAdminSnapshot(roomId)
}

export async function advanceToNextLot(roomId: string): Promise<AdminSnapshot> {
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
