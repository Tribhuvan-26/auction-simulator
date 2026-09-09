// prisma/seed.ts
import { PrismaClient, PlayerRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const TEAM_NAMES = [
  ['Mumbai Monarchs', 'MUM'], ['Chennai Chargers', 'CHE'], ['Delhi Daredevils', 'DEL'],
  ['Bangalore Blazers', 'BLR'], ['Kolkata Knights', 'KOL'], ['Hyderabad Hawks', 'HYD'],
  ['Punjab Panthers', 'PUN'], ['Rajasthan Royals2', 'RAJ'],
] as const

const ROLES: PlayerRole[] = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']
const SETS = ['Marquee Set', 'Set 2 - Pacers', 'Set 3 - Spinners', 'Set 4 - Uncapped']

export async function seed(prisma: PrismaClient) {
  const room = await prisma.auctionRoom.create({
    data: { name: 'Demo Auction', phase: 'SETUP' },
  })

  for (const [name, shortCode] of TEAM_NAMES) {
    await prisma.team.create({
      data: {
        roomId: room.id,
        name,
        shortCode,
        purseTotal: 10000,
        purseRemaining: 10000,
        squadMax: 25,
        squadMin: 18,
        overseasSlotsMax: 8,
      },
    })
  }

  for (let i = 0; i < 40; i++) {
    await prisma.player.create({
      data: {
        roomId: room.id,
        name: `Player ${i + 1}`,
        role: ROLES[i % ROLES.length],
        basePrice: 20 + (i % 5) * 10,
        nationality: i % 3 === 0 ? 'Overseas' : 'India',
        isOverseas: i % 3 === 0,
        matches: 50 + i,
        setNumber: SETS[i % SETS.length],
      },
    })
  }

  return room
}

if (require.main === module) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })
  seed(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
      process.exit(1)
    })
}
