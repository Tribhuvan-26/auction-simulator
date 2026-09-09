// prisma/seed.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient, PlayerRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Real IPL 2026 mega-auction results (prisma/data/ipl-2026-players.csv) — official
// franchise names, base prices, and winning bids, converted into a fresh queue so
// the room can re-run the auction live instead of replaying pre-decided results.
const CSV_PATH = join(__dirname, 'data/ipl-2026-players.csv')

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

// The CSV has no role column — round-robin across the four roles so the queue
// still filters/displays sensibly. Not the players' real roles; swap in real
// data here if it becomes available.
const ROLES: PlayerRole[] = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']

type CsvPlayer = { name: string; nationality: string; basePrice: number; teamName: string; capped: string }

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ',' && !inQuotes) {
      fields.push(cur)
      cur = ''
    } else cur += ch
  }
  fields.push(cur)
  return fields
}

// "30,00,000 " (Indian lakh/crore grouping) -> 30 (whole lakhs, matches the
// scale basePrice/purseTotal already use elsewhere in the schema).
function parseLakhs(raw: string): number {
  return Math.round(Number(raw.replace(/["\s,]/g, '')) / 100_000)
}

function loadCsvPlayers(): CsvPlayer[] {
  const lines = readFileSync(CSV_PATH, 'utf-8').trim().split('\n').slice(1)
  return lines.map((line) => {
    const [, name, nationality, basePrice, , teamName, capped] = parseCsvLine(line)
    return {
      name: name.trim(),
      nationality: nationality.trim(),
      basePrice: parseLakhs(basePrice),
      teamName: teamName.trim(),
      capped: capped.trim(),
    }
  })
}

export async function seed(prisma: PrismaClient) {
  const csvPlayers = loadCsvPlayers()
  const teamNames = [...new Set(csvPlayers.map((p) => p.teamName))]

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

  for (let i = 0; i < csvPlayers.length; i++) {
    const p = csvPlayers[i]
    const isOverseas = p.nationality === 'Overseas'
    await prisma.player.create({
      data: {
        roomId: room.id,
        name: p.name,
        role: ROLES[i % ROLES.length],
        basePrice: p.basePrice,
        nationality: isOverseas ? 'Overseas' : 'India',
        isOverseas,
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
