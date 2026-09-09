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

  const lot = await prisma.auctionLot.findFirst({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
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
