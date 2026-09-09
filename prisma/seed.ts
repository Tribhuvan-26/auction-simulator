// prisma/seed.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient, PlayerRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Full official IPL 2026 squads (prisma/data/ipl-2026-official-players.json) —
// scraped from each franchise's official squad page, merged with the real
// auction CSV (base price / nationality / capped status) wherever a player
// appears in both. Players not in the auction CSV (backup/domestic squad
// members who weren't part of the mega-auction) get placeholder base
// price/nationality — see prisma/data/build note in the extraction script.
const DATA_PATH = join(__dirname, 'data/ipl-2026-official-players.json')

// Neither the CSV nor the squad pages carry a role column (the iplt20.com
// squad cards render name + photo only), so roles are curated by hand in
// prisma/data/player-roles.json — keyed by the exact name in the dataset.
const ROLES_PATH = join(__dirname, 'data/player-roles.json')

const TEAM_META: Record<string, { code: string; color: string }> = {
  'Chennai Super Kings': { code: 'CSK', color: '#F9CD05' },
  'Delhi Capitals': { code: 'DC', color: '#17479E' },
  'Gujarat Titans': { code: 'GT', color: '#1C1C34' },
  'Kolkata Knight Riders': { code: 'KKR', color: '#3A225D' },
  'Lucknow Super Giants': { code: 'LSG', color: '#A72056' },
  'Mumbai Indians': { code: 'MI', color: '#004BA0' },
  'Punjab Kings': { code: 'PBKS', color: '#ED1B24' },
  'Rajasthan Royals': { code: 'RR', color: '#EA1A85' },
  'Royal Challengers Bengaluru': { code: 'RCB', color: '#EC1C24' },
  'Sunrisers Hyderabad': { code: 'SRH', color: '#F26522' },
}

type OfficialPlayer = {
  name: string
  team: string
  basePrice: number
  nationality: string
  isOverseas: boolean
  capped: string
  photoUrl: string | null
}

function loadOfficialPlayers(): OfficialPlayer[] {
  return JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
}

function loadRoles(): Record<string, PlayerRole> {
  return JSON.parse(readFileSync(ROLES_PATH, 'utf-8'))
}

export async function seed(prisma: PrismaClient) {
  const officialPlayers = loadOfficialPlayers()
  const rolesByName = loadRoles()
  const unroled = officialPlayers.filter((p) => !rolesByName[p.name]).map((p) => p.name)
  if (unroled.length) throw new Error(`No role in player-roles.json for: ${unroled.join(', ')}`)
  const teamNames = [...new Set(officialPlayers.map((p) => p.team))]

  const room = await prisma.auctionRoom.create({
    data: { name: 'IPL 2026 Auction', phase: 'SETUP' },
  })

  const teamIdByName = new Map<string, string>()
  for (const teamName of teamNames) {
    const meta = TEAM_META[teamName]
    const team = await prisma.team.create({
      data: {
        roomId: room.id,
        name: teamName,
        shortCode: meta.code,
        colorAccent: meta.color,
        purseTotal: 12000,
        purseRemaining: 12000,
        squadMax: 25,
        squadMin: 18,
        overseasSlotsMax: 8,
      },
    })
    teamIdByName.set(teamName, team.id)
  }

  for (const p of officialPlayers) {
    await prisma.player.create({
      data: {
        roomId: room.id,
        name: p.name,
        role: rolesByName[p.name],
        basePrice: p.basePrice,
        photoUrl: p.photoUrl,
        nationality: p.nationality,
        isOverseas: p.isOverseas,
        matches: 0,
        setNumber: p.capped === 'Capped' ? 'Capped Players' : 'Uncapped Players',
        status: 'UPCOMING',
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
