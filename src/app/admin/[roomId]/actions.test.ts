import { vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getAdminSnapshot, getPublicSnapshot, placeBid, markSold, markUnsold, undoLastBid, controlTimer, setPhase, advanceToNextLot } from './actions'
import { emitAuctionEvent } from '@/lib/socket-emitter'

vi.mock('@/lib/socket-emitter', () => ({
  emitAuctionEvent: vi.fn(async () => {}),
}))

// The guards read cookies(), which needs a request scope these tests don't
// have. Their own behaviour is covered in src/lib/team-auth.test.ts; here we
// only assert that every mutation calls them.
vi.mock('@/lib/team-auth', () => ({
  assertCanBidAs: vi.fn(async () => {}),
  assertIsAuctioneer: vi.fn(async () => {}),
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
      data: { roomId, name: 'Test Team', shortCode: 'TST', purseTotal: 10000, purseRemaining: 9000, squadMax: 25, squadMin: 18, passcode: '9001', overseasSlotsMax: 8 },
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

  it('leaves the queue out of the public snapshot but keeps everything else', async () => {
    const admin = await getAdminSnapshot(roomId)
    const pub = await getPublicSnapshot(roomId)
    expect('queue' in pub).toBe(false)
    expect(admin.queue.length).toBeGreaterThan(0)
    expect(pub.currentLot).toEqual(admin.currentLot)
    expect(pub.teams).toEqual(admin.teams)
    expect(pub.soldLog).toEqual(admin.soldLog)
    expect(pub.resultLog).toEqual(admin.resultLog)
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
      data: { roomId, name: 'Bid Team', shortCode: 'BID', purseTotal: 10000, purseRemaining: 10000, squadMax: 25, squadMin: 18, passcode: '9002', overseasSlotsMax: 8 },
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

  it('authorises the bidder before touching the database', async () => {
    const { assertCanBidAs } = await import('@/lib/team-auth')
    vi.mocked(assertCanBidAs).mockRejectedValueOnce(new Error('Unauthorized: nope'))
    await expect(placeBid(roomId, teamId, 25)).rejects.toThrow(/unauthorized/i)
    expect(await prisma.bid.count({ where: { lotId } })).toBe(0)
    vi.mocked(assertCanBidAs).mockResolvedValue(undefined)
  })

  // Lot is BIDDING at 20 L, so the ladder's next amount is 25 L.
  it('creates a bid, updates the lot, and returns the fresh snapshot', async () => {
    const snapshot = await placeBid(roomId, teamId, 25)
    expect(snapshot.currentLot?.currentBid).toBe(25)
    expect(snapshot.currentLot?.currentBiddingTeamId).toBe(teamId)
    expect(snapshot.currentLot?.bidHistory).toHaveLength(1)
    // The broadcast carries the new lot, so screens don't have to refetch it.
    expect(emitAuctionEvent).toHaveBeenCalledWith(
      roomId,
      expect.objectContaining({ type: 'BID', teamId, amount: 25, at: snapshot.at, lot: snapshot.currentLot })
    )
  })

  it('rejects the slower of two bids computed against the same price', async () => {
    // Both bids see 25 L and both compute 30 L; only one may land.
    await prisma.auctionLot.update({ where: { id: lotId }, data: { currentBid: 25, status: 'BIDDING', currentBiddingTeamId: null } })
    const results = await Promise.allSettled([
      placeBid(roomId, teamId, 30),
      placeBid(roomId, teamId, 30),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
    const lot = await prisma.auctionLot.findUniqueOrThrow({ where: { id: lotId } })
    expect(lot.currentBid).toBe(30)
    expect(await prisma.bid.count({ where: { lotId, amount: 30 } })).toBe(1)
  })
})

describe('markSold', () => {
  let roomId: string, teamId: string, playerId: string, lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Sold Room', phase: 'LIVE' } })
    roomId = room.id
    const team = await prisma.team.create({
      data: { roomId, name: 'Sold Team', shortCode: 'SLD', purseTotal: 10000, purseRemaining: 10000, squadMax: 25, squadMin: 18, passcode: '9003', overseasSlotsMax: 8 },
    })
    teamId = team.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Sold Player', role: 'BATTER', basePrice: 20, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    playerId = player.id
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId, currentBid: 80, currentBiddingTeamId: teamId, status: 'BIDDING', timerSeconds: 30 },
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

  it('sets the lot sold, assigns the player to the team, and deducts the purse', async () => {
    const snapshot = await markSold(roomId)
    expect(snapshot.currentLot?.status).toBe('SOLD')
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } })
    expect(player.status).toBe('SOLD')
    expect(player.teamId).toBe(teamId)
    expect(player.soldPrice).toBe(80)
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } })
    expect(team.purseRemaining).toBe(9920)
  })

  it('adds the sale to the result log with the winning team', async () => {
    const { resultLog } = await getPublicSnapshot(roomId)
    expect(resultLog).toEqual([
      { id: lotId, playerId, playerName: 'Sold Player', status: 'SOLD', price: 80, teamShortCode: 'SLD', colorAccent: '#2074D5' },
    ])
  })

  it('a second sold call and a late bid leave the sale untouched', async () => {
    await expect(markSold(roomId)).rejects.toThrow(/no lot on the block/i)
    await expect(placeBid(roomId, teamId, 85)).rejects.toThrow()
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } })
    expect(team.purseRemaining).toBe(9920)
    const lot = await prisma.auctionLot.findUniqueOrThrow({ where: { id: lotId } })
    expect(lot.status).toBe('SOLD')
  })
})

describe('concurrent sold calls', () => {
  let roomId: string, teamId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Race Room', phase: 'LIVE' } })
    roomId = room.id
    const team = await prisma.team.create({
      data: { roomId, name: 'Race Team', shortCode: 'RCE', purseTotal: 1000, purseRemaining: 1000, squadMax: 25, squadMin: 18, passcode: '9007', overseasSlotsMax: 8 },
    })
    teamId = team.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Race Player', role: 'BATTER', basePrice: 20, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    await prisma.auctionLot.create({
      data: { roomId, playerId: player.id, currentBid: 100, currentBiddingTeamId: teamId, status: 'BIDDING', timerSeconds: 30 },
    })
  })

  afterAll(async () => {
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.team.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('debits the purse once when SOLD is pressed twice at the same time', async () => {
    const results = await Promise.allSettled([markSold(roomId), markSold(roomId)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } })
    expect(team.purseRemaining).toBe(900)
  })
})

describe('markUnsold', () => {
  let roomId: string, playerId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Unsold Room', phase: 'LIVE' } })
    roomId = room.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Unsold Player', role: 'BOWLER', basePrice: 20, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    playerId = player.id
    await prisma.auctionLot.create({
      data: { roomId, playerId, currentBid: 20, status: 'BIDDING', timerSeconds: 30 },
    })
  })

  afterAll(async () => {
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('sets the lot and player unsold with no team assigned', async () => {
    const snapshot = await markUnsold(roomId)
    expect(snapshot.currentLot?.status).toBe('UNSOLD')
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } })
    expect(player.status).toBe('UNSOLD')
    expect(player.teamId).toBeNull()
  })

  it('adds the lot to the result log with no team or price', async () => {
    const { resultLog } = await getPublicSnapshot(roomId)
    expect(resultLog).toMatchObject([{ playerName: 'Unsold Player', status: 'UNSOLD', price: null, teamShortCode: null, colorAccent: null }])
  })
})

describe('undoLastBid', () => {
  let roomId: string, teamId: string, lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Undo Room', phase: 'LIVE' } })
    roomId = room.id
    const team = await prisma.team.create({
      data: { roomId, name: 'Undo Team', shortCode: 'UND', purseTotal: 10000, purseRemaining: 10000, squadMax: 25, squadMin: 18, passcode: '9004', overseasSlotsMax: 8 },
    })
    teamId = team.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Undo Player', role: 'BATTER', basePrice: 20, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId: player.id, currentBid: 20, status: 'BIDDING', timerSeconds: 30 },
    })
    lotId = lot.id
    await prisma.bid.create({ data: { lotId, teamId, amount: 40 } })
    await prisma.bid.create({ data: { lotId, teamId, amount: 60 } })
    await prisma.auctionLot.update({ where: { id: lotId }, data: { currentBid: 60, currentBiddingTeamId: teamId } })
  })

  afterAll(async () => {
    await prisma.bid.deleteMany({ where: { lotId } })
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.team.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('pops the last bid and recomputes currentBid from the remaining history', async () => {
    const snapshot = await undoLastBid(roomId)
    expect(snapshot.currentLot?.currentBid).toBe(40)
    expect(snapshot.currentLot?.bidHistory).toHaveLength(1)
  })

  it("undo again with one bid left falls back to the lot player's base price", async () => {
    const snapshot = await undoLastBid(roomId)
    expect(snapshot.currentLot?.currentBid).toBe(20)
    expect(snapshot.currentLot?.currentBiddingTeamId).toBeNull()
    expect(snapshot.currentLot?.bidHistory).toHaveLength(0)
  })
})

describe('controlTimer', () => {
  let roomId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Timer Room', phase: 'LIVE' } })
    roomId = room.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Timer Player', role: 'BATTER', basePrice: 20, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    await prisma.auctionLot.create({
      data: { roomId, playerId: player.id, currentBid: 20, status: 'BIDDING', timerSeconds: 30 },
    })
  })

  afterAll(async () => {
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('add10 increments timerSeconds by 10', async () => {
    const snapshot = await controlTimer(roomId, 'add10')
    expect(snapshot.currentLot?.timerSeconds).toBe(40)
  })

  it('reset sets timerSeconds back to 30', async () => {
    const snapshot = await controlTimer(roomId, 'reset')
    expect(snapshot.currentLot?.timerSeconds).toBe(30)
  })
})

describe('setPhase', () => {
  it('refuses bids while the room is paused', async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Paused Room', phase: 'PAUSED' } })
    const team = await prisma.team.create({
      data: { roomId: room.id, name: 'P Team', shortCode: 'PTM', purseTotal: 10000, purseRemaining: 10000, squadMax: 25, squadMin: 18, passcode: '9101', overseasSlotsMax: 8 },
    })
    await expect(placeBid(room.id, team.id, 20)).rejects.toThrow(/paused/i)
    await prisma.team.delete({ where: { id: team.id } })
    await prisma.auctionRoom.delete({ where: { id: room.id } })
  })

  it('updates room phase', async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Phase Room', phase: 'LIVE' } })
    const snapshot = await setPhase(room.id, 'PAUSED')
    expect(snapshot.room.phase).toBe('PAUSED')
    await prisma.auctionRoom.delete({ where: { id: room.id } })
  })
})

describe('advanceToNextLot', () => {
  let roomId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Advance Room', phase: 'LIVE' } })
    roomId = room.id
    await prisma.player.create({
      data: { roomId, name: 'Next Player', role: 'BATTER', basePrice: 30, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'UPCOMING' },
    })
    await prisma.player.create({
      data: { roomId, name: 'Later Player', role: 'BOWLER', basePrice: 40, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'UPCOMING' },
    })
  })

  afterAll(async () => {
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('loads the next upcoming player as the current lot at its base price', async () => {
    const snapshot = await advanceToNextLot(roomId)
    expect(snapshot.currentLot?.player.name).toBe('Next Player')
    expect(snapshot.currentLot?.currentBid).toBe(30)
    expect(snapshot.currentLot?.status).toBe('QUEUED')
  })

  it('refuses to open a second lot while one is still on the block', async () => {
    const snapshot = await advanceToNextLot(roomId)
    expect(snapshot.currentLot?.player.name).toBe('Next Player')
    expect(await prisma.auctionLot.count({ where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } } })).toBe(1)
  })

  it('two clicks at once still open only one lot', async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Race Room', phase: 'SETUP' } })
    for (const name of ['Race A', 'Race B']) {
      await prisma.player.create({
        data: { roomId: room.id, name, role: 'BATTER', basePrice: 20, nationality: 'India', matches: 1, setNumber: 'Set 1', status: 'UPCOMING' },
      })
    }
    await Promise.all([advanceToNextLot(room.id), advanceToNextLot(room.id)])
    expect(await prisma.auctionLot.count({ where: { roomId: room.id } })).toBe(1)
    // Calling the first lot starts a room that was still in SETUP.
    expect((await prisma.auctionRoom.findUniqueOrThrow({ where: { id: room.id } })).phase).toBe('LIVE')

    await prisma.auctionLot.deleteMany({ where: { roomId: room.id } })
    await prisma.player.deleteMany({ where: { roomId: room.id } })
    await prisma.auctionRoom.delete({ where: { id: room.id } })
  })
})

describe('placeBid validation', () => {
  let roomId: string, teamId: string, poorTeamId: string, lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Guard Room', phase: 'LIVE' } })
    roomId = room.id
    const team = await prisma.team.create({
      data: { roomId, name: 'Broke Team', shortCode: 'BRK', purseTotal: 100, purseRemaining: 100, squadMax: 25, squadMin: 18, passcode: '9005', overseasSlotsMax: 0 },
    })
    teamId = team.id
    const poor = await prisma.team.create({
      data: { roomId, name: 'Poor Team', shortCode: 'POR', purseTotal: 100, purseRemaining: 10, squadMax: 25, squadMin: 18, passcode: '9006', overseasSlotsMax: 8 },
    })
    poorTeamId = poor.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Guard Player', role: 'BATTER', basePrice: 20, nationality: 'Australia', isOverseas: true, matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId: player.id, currentBid: 50, status: 'BIDDING', timerSeconds: 30 },
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

  // Lot sits at 50 L, so the ladder allows exactly 55 L and nothing else.
  it('rejects anything but the next amount on the ladder', async () => {
    await expect(placeBid(roomId, teamId, 50)).rejects.toThrow(/off-tier/i)
    await expect(placeBid(roomId, teamId, 60)).rejects.toThrow(/off-tier/i)
    await expect(placeBid(roomId, teamId, 500)).rejects.toThrow(/off-tier/i)
  })

  it('rejects a team from another room', async () => {
    const other = await prisma.auctionRoom.create({ data: { name: 'Other Room', phase: 'LIVE' } })
    const intruder = await prisma.team.create({
      data: { roomId: other.id, name: 'Intruder', shortCode: 'INT', passcode: '9500', purseTotal: 10000, purseRemaining: 10000, squadMax: 25, squadMin: 18, overseasSlotsMax: 8 },
    })
    await expect(placeBid(roomId, intruder.id, 55)).rejects.toThrow()
    expect(await prisma.bid.count({ where: { teamId: intruder.id } })).toBe(0)
    await prisma.team.delete({ where: { id: intruder.id } })
    await prisma.auctionRoom.delete({ where: { id: other.id } })
  })

  it('rejects a bid beyond the purse', async () => {
    await expect(placeBid(roomId, poorTeamId, 55)).rejects.toThrow(/purse insufficient/i)
  })

  it('rejects an overseas player when no overseas slots remain', async () => {
    await expect(placeBid(roomId, teamId, 55)).rejects.toThrow(/overseas slots full/i)
  })

  it('rejects a team raising its own winning bid', async () => {
    await prisma.auctionLot.update({ where: { id: lotId }, data: { currentBiddingTeamId: poorTeamId } })
    await expect(placeBid(roomId, poorTeamId, 55)).rejects.toThrow(/already hold the highest bid/i)
    await prisma.auctionLot.update({ where: { id: lotId }, data: { currentBiddingTeamId: null } })
  })
})

describe('undoLastBid on a closed lot', () => {
  let roomId: string, teamId: string, playerId: string, lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Undo Room', phase: 'LIVE', adminPasscode: '4242' } })
    roomId = room.id
    const team = await prisma.team.create({
      data: { roomId, name: 'Undo Team', shortCode: 'UND', passcode: '9600', purseTotal: 10000, purseRemaining: 9920, squadMax: 25, squadMin: 18, overseasSlotsMax: 8, overseasSlotsUsed: 1 },
    })
    teamId = team.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Undo Player', role: 'BATTER', basePrice: 20, nationality: 'Australia', isOverseas: true, matches: 10, setNumber: 'Set 1', status: 'SOLD', teamId: team.id, soldPrice: 80 },
    })
    playerId = player.id
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId, currentBid: 80, currentBiddingTeamId: team.id, status: 'SOLD', timerSeconds: 30 },
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

  it('reverses a sale: refunds the purse, frees the slots, reopens the lot', async () => {
    const snapshot = await undoLastBid(roomId)
    expect(snapshot.currentLot?.status).toBe('BIDDING')
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } })
    expect(team.purseRemaining).toBe(10000)
    expect(team.overseasSlotsUsed).toBe(0)
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } })
    expect(player.status).toBe('LIVE')
    expect(player.teamId).toBeNull()
    expect(player.soldPrice).toBeNull()
  })

  it('puts an unsold lot back on the block instead of throwing', async () => {
    await prisma.auctionLot.update({ where: { id: lotId }, data: { status: 'UNSOLD', currentBiddingTeamId: null } })
    await prisma.player.update({ where: { id: playerId }, data: { status: 'UNSOLD' } })
    const snapshot = await undoLastBid(roomId)
    expect(snapshot.currentLot?.status).toBe('QUEUED')
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } })
    expect(player.status).toBe('LIVE')
  })
})

describe('mutations with no lot on the block', () => {
  let roomId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Empty Room', phase: 'LIVE', adminPasscode: '4243' } })
    roomId = room.id
  })

  afterAll(async () => {
    await prisma.auctionRoom.delete({ where: { id: roomId } })
    await prisma.$disconnect()
  })

  it('says so in words rather than leaking a Prisma error', async () => {
    await expect(markSold(roomId)).rejects.toThrow(/no lot on the block/i)
    await expect(markUnsold(roomId)).rejects.toThrow(/no lot on the block/i)
    await expect(controlTimer(roomId, 'reset')).rejects.toThrow(/no lot on the block/i)
  })

  it('undo is a no-op when the room has never had a lot', async () => {
    const snapshot = await undoLastBid(roomId)
    expect(snapshot.currentLot).toBeNull()
  })
})
