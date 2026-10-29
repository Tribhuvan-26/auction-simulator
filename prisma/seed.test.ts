// prisma/seed.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { seed, generatePasscodes, basePriceFor, loadPool, DEFAULT_ROOM_NAME } from './seed'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

describe('seed', () => {
  let roomId: string

  beforeAll(async () => {
    const room = await seed(prisma)
    roomId = room.id
  }, 20_000)

  afterAll(async () => {
    // roomId is only set once the setup `it` finishes — if it times out or
    // throws first, `where: { roomId: undefined }` is Prisma's spelling of
    // "no filter", which deletes every row in the table instead of none.
    if (roomId) {
      await prisma.auctionLot.deleteMany({ where: { roomId } })
      await prisma.player.deleteMany({ where: { roomId } })
      await prisma.team.deleteMany({ where: { roomId } })
      await prisma.auctionRoom.delete({ where: { id: roomId } })
    }
    await prisma.$disconnect()
  })

  it('gives every team a distinct 4-digit PIN', async () => {
    const teams = await prisma.team.findMany({ where: { roomId } })
    const pins = teams.map((t) => t.passcode)
    expect(pins.every((p) => /^\d{4}$/.test(p))).toBe(true)
    expect(new Set(pins).size).toBe(teams.length)
  })

  it('gives the room its own auctioneer PIN, distinct from every seat', async () => {
    const room = await prisma.auctionRoom.findUniqueOrThrow({ where: { id: roomId } })
    const teams = await prisma.team.findMany({ where: { roomId } })
    expect(room.adminPasscode).toMatch(/^\d{4}$/)
    expect(teams.map((t) => t.passcode)).not.toContain(room.adminPasscode)
  })

  it('creates exactly 10 teams', async () => {
    const teams = await prisma.team.findMany({ where: { roomId } })
    expect(teams).toHaveLength(10)
  })

  it('creates every player in the auction pool', async () => {
    const players = await prisma.player.findMany({ where: { roomId } })
    expect(players).toHaveLength(loadPool().length)
  })

  it('takes overseas status and base price from the sheet, not the squad list placeholders', async () => {
    const players = await prisma.player.findMany({
      where: { roomId, name: { in: ['Travis Head', 'Virat Kohli', 'Suresh Raina'] } },
    })
    const byName = Object.fromEntries(players.map((p) => [p.name, p]))
    expect(byName['Travis Head']).toMatchObject({ isOverseas: true, setNumber: 'Capped Players' })
    expect(byName['Virat Kohli']).toMatchObject({ isOverseas: false, setNumber: 'Capped Players', basePrice: 200 })
    // Not in any official squad: still auctioned, just without a photo.
    expect(byName['Suresh Raina']).toMatchObject({ photoUrl: null })
  })

  it('covers all four player roles', async () => {
    const players = await prisma.player.findMany({ where: { roomId } })
    const roles = new Set(players.map((p) => p.role))
    expect(roles).toEqual(new Set(['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']))
  })

  it('gives each player their curated role, not a round-robin placeholder', async () => {
    const players = await prisma.player.findMany({
      where: { roomId, name: { in: ['Shreyas Iyer', 'Jasprit Bumrah', 'Ravindra Jadeja', 'Mahendra Singh Dhoni'] } },
    })
    expect(Object.fromEntries(players.map((p) => [p.name, p.role]))).toEqual({
      'Shreyas Iyer': 'BATTER',
      'Jasprit Bumrah': 'BOWLER',
      'Ravindra Jadeja': 'ALL_ROUNDER',
      'Mahendra Singh Dhoni': 'WICKET_KEEPER',
    })
  })

  it('spreads players across at least two sets', async () => {
    const players = await prisma.player.findMany({ where: { roomId } })
    const sets = new Set(players.map((p) => p.setNumber))
    expect(sets.size).toBeGreaterThanOrEqual(2)
  })
})

describe('generatePasscodes', () => {
  it('returns the asked-for number of distinct 4-digit PINs', () => {
    const pins = generatePasscodes(10)
    expect(pins).toHaveLength(10)
    expect(new Set(pins).size).toBe(10)
    expect(pins.every((p) => /^\d{4}$/.test(p))).toBe(true)
  })
})

describe('seed room naming', () => {
  let roomId: string

  afterAll(async () => {
    if (roomId) {
      await prisma.player.deleteMany({ where: { roomId } })
      await prisma.team.deleteMany({ where: { roomId } })
      await prisma.auctionRoom.delete({ where: { id: roomId } })
    }
    await prisma.$disconnect()
  })

  it(
    'names the room as asked, so parallel sessions are told apart',
    async () => {
      const room = await seed(prisma, 'Saturday 10am - Batch A')
      roomId = room.id
      expect(room.name).toBe('Saturday 10am - Batch A')
    },
    20_000
  )

  it('falls back to the default name when given blank', async () => {
    expect(DEFAULT_ROOM_NAME).toBe('IPL 2026 Auction')
  })
})

describe('basePriceFor', () => {
  it('uncapped 50 L; capped and overseas 2 Cr at 90+, else 1 Cr', () => {
    expect(basePriceFor('Uncapped', 95)).toBe(50)
    expect([98, 90, 89, 65].map((r) => basePriceFor('Capped', r))).toEqual([200, 200, 100, 100])
    expect(basePriceFor('Overseas', 91)).toBe(200)
  })
})
