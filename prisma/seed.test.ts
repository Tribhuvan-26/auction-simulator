// prisma/seed.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { seed, generatePasscodes, DEFAULT_ROOM_NAME } from './seed'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

describe('seed', () => {
  let roomId: string

  beforeAll(async () => {
    const room = await seed(prisma)
    roomId = room.id
  })

  afterAll(async () => {
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.team.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
    await prisma.$disconnect()
  })

  it('gives every team a distinct 4-digit PIN', async () => {
    const teams = await prisma.team.findMany({ where: { roomId } })
    const pins = teams.map((t) => t.passcode)
    expect(pins.every((p) => /^\d{4}$/.test(p))).toBe(true)
    expect(new Set(pins).size).toBe(teams.length)
  })

  it('creates exactly 10 teams', async () => {
    const teams = await prisma.team.findMany({ where: { roomId } })
    expect(teams).toHaveLength(10)
  })

  it('creates every official player', async () => {
    const players = await prisma.player.findMany({ where: { roomId } })
    expect(players).toHaveLength(254)
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
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.team.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
    await prisma.$disconnect()
  })

  it('names the room as asked, so parallel sessions are told apart', async () => {
    const room = await seed(prisma, 'Saturday 10am - Batch A')
    roomId = room.id
    expect(room.name).toBe('Saturday 10am - Batch A')
  })

  it('falls back to the default name when given blank', async () => {
    expect(DEFAULT_ROOM_NAME).toBe('IPL 2026 Auction')
  })
})
