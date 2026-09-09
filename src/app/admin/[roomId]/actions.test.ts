import { vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getAdminSnapshot, placeBid } from './actions'
import { emitAuctionEvent } from '@/lib/socket-emitter'

vi.mock('@/lib/socket-emitter', () => ({
  emitAuctionEvent: vi.fn(async () => {}),
}))

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

describe('getAdminSnapshot', () => {
  let roomId: string
  let teamId: string
  let playerId: string
  let lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Test Room', phase: 'LIVE' } })
    roomId = room.id
    const team = await prisma.team.create({
      data: { roomId, name: 'Test Team', shortCode: 'TST', purseTotal: 10000, purseRemaining: 9000, squadMax: 25, squadMin: 18, overseasSlotsMax: 8 },
    })
    teamId = team.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Test Player', role: 'BATTER', basePrice: 20, nationality: 'India', matches: 50, setNumber: 'Set 1', status: 'LIVE' },
    })
    playerId = player.id
    await prisma.player.create({
      data: { roomId, name: 'Queued Player', role: 'BOWLER', basePrice: 30, nationality: 'India', matches: 20, setNumber: 'Set 1', status: 'UPCOMING' },
    })
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId, currentBid: 20, status: 'BIDDING', timerSeconds: 30, currentBiddingTeamId: teamId },
    })
    lotId = lot.id
    await prisma.bid.create({ data: { lotId, teamId, amount: 20 } })
  })

  afterAll(async () => {
    await prisma.bid.deleteMany({ where: { lotId } })
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.team.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
    await prisma.$disconnect()
  })

  it('returns room phase and the current lot with player details and bid history', async () => {
    const snapshot = await getAdminSnapshot(roomId)
    expect(snapshot.room.phase).toBe('LIVE')
    expect(snapshot.currentLot?.player.name).toBe('Test Player')
    expect(snapshot.currentLot?.currentBid).toBe(20)
    expect(snapshot.currentLot?.bidHistory).toHaveLength(1)
    expect(snapshot.currentLot?.bidHistory[0]).toMatchObject({ teamId, teamName: 'Test Team', amount: 20 })
  })

  it('returns teams with squad/purse counts', async () => {
    const snapshot = await getAdminSnapshot(roomId)
    expect(snapshot.teams).toHaveLength(1)
    expect(snapshot.teams[0]).toMatchObject({ name: 'Test Team', purseRemaining: 9000, squadCount: 0 })
  })

  it('returns the upcoming-player queue excluding the current lot player', async () => {
    const snapshot = await getAdminSnapshot(roomId)
    expect(snapshot.queue).toHaveLength(1)
    expect(snapshot.queue[0].name).toBe('Queued Player')
  })
})

describe('placeBid', () => {
  let roomId: string
  let teamId: string
  let lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Bid Room', phase: 'LIVE' } })
    roomId = room.id
    const team = await prisma.team.create({
      data: { roomId, name: 'Bid Team', shortCode: 'BID', purseTotal: 10000, purseRemaining: 10000, squadMax: 25, squadMin: 18, overseasSlotsMax: 8 },
    })
    teamId = team.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Bid Player', role: 'BATTER', basePrice: 20, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId: player.id, currentBid: 20, status: 'BIDDING', timerSeconds: 30 },
    })
    lotId = lot.id
  })

  afterAll(async () => {
    await prisma.bid.deleteMany({ where: { lotId } })
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.team.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('creates a bid, updates the lot, and returns the fresh snapshot', async () => {
    const snapshot = await placeBid(roomId, teamId, 50)
    expect(snapshot.currentLot?.currentBid).toBe(50)
    expect(snapshot.currentLot?.currentBiddingTeamId).toBe(teamId)
    expect(snapshot.currentLot?.bidHistory).toHaveLength(1)
    expect(emitAuctionEvent).toHaveBeenCalledWith(roomId, { type: 'BID', teamId, amount: 50 })
  })
})
