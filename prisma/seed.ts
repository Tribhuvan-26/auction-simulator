// prisma/seed.ts
import { randomInt } from 'crypto'
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

// Files live in public/logos/<code>.svg, lowercase — dropped in by hand,
// see public/logos/ for the current set.
const logoUrl = (code: string) => `/logos/${code.toLowerCase()}.svg`

type OfficialPlayer = {
  name: string
  team: string
  basePrice: number
  nationality: string
  isOverseas: boolean
  capped: string
  photoUrl: string | null
}

// Who goes into a room, with role, category and rating — generated from the
// auction sheet by scripts/import_player_sheet.py. The sheet is the source of
// truth for these; the official squad list above only supplies photos (and
// nationality), and its capped/overseas flags are placeholders for most rows.
const POOL_PATH = join(__dirname, 'data/auction-pool.json')

type PoolEntry = { name: string; role: PlayerRole; category: 'Capped' | 'Uncapped' | 'Overseas'; rating: number }

// Base price comes from the player's rating, in lakhs:
// 90–100 → ₹2 Cr, 80–89 → ₹1 Cr, below → ₹50 L.
export function basePriceForRating(rating: number): number {
  return rating >= 90 ? 200 : rating >= 80 ? 100 : 50
}

export function loadPool(): PoolEntry[] {
  return JSON.parse(readFileSync(POOL_PATH, 'utf-8'))
}

function loadOfficialPlayers(): Map<string, OfficialPlayer> {
  const players: OfficialPlayer[] = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  return new Map(players.map((p) => [p.name, p]))
}

/**
 * The pool as Player rows for one room — shared by a fresh seed and by
 * prisma/reset-room.ts, which reloads an existing room's players.
 */
export function poolPlayerRows(roomId: string) {
  const official = loadOfficialPlayers()
  return loadPool().map((p, i) => {
    const known = official.get(p.name)
    const overseas = p.category === 'Overseas'
    return {
      roomId,
      name: p.name,
      role: p.role,
      basePrice: basePriceForRating(p.rating),
      // Legends outside the official squads have no photo; the UI shows initials.
      photoUrl: known?.photoUrl ?? null,
      nationality: overseas ? (known && known.nationality !== 'India' ? known.nationality : 'Overseas') : 'India',
      isOverseas: overseas,
      matches: 0,
      setNumber: p.category === 'Uncapped' ? 'Uncapped Players' : 'Capped Players',
      status: 'UPCOMING' as const,
      // Sheet order is the auction order, whatever order the ids come out in.
      queueOrder: i,
    }
  })
}

/**
 * One 4-digit PIN per team seat, drawn from a CSPRNG and distinct within the
 * room (the schema enforces that too). Sequential or name-derived PINs would
 * let anyone holding one seat guess the rest.
 */
export function generatePasscodes(count: number): string[] {
  const pins = new Set<string>()
  while (pins.size < count) pins.add(String(randomInt(0, 10000)).padStart(4, '0'))
  return [...pins]
}

export const DEFAULT_ROOM_NAME = 'IPL 2026 Auction'

// Short code for the room's URLs (e.g. "ROOM-7F2A") — the cuid stays the
// real id everywhere else. Collisions are astronomically unlikely at this
// length; the DB's unique constraint is the actual backstop.
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — easy to read aloud
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += chars[randomInt(0, chars.length)]
  return `ROOM-${suffix}`
}

/**
 * Populates an existing room with the full official team + player set — the
 * half of `seed()` that doesn't touch AuctionRoom. Used by `seed()` for a
 * fresh room, and by the restore script for a room whose teams/players were
 * wiped but whose room row (and passcode) survived.
 */
export async function seedInto(prisma: PrismaClient, roomId: string, teamPasscodes?: string[]) {
  // All ten franchises, whoever is in the pool — teams bid, they don't own pool players.
  const teamNames = Object.keys(TEAM_META)
  const passcodes = teamPasscodes ?? generatePasscodes(teamNames.length)

  for (const [i, teamName] of teamNames.entries()) {
    const meta = TEAM_META[teamName]
    await prisma.team.create({
      data: {
        roomId,
        name: teamName,
        shortCode: meta.code,
        colorAccent: meta.color,
        logoUrl: logoUrl(meta.code),
        purseTotal: 12000,
        purseRemaining: 12000,
        squadMax: 25,
        squadMin: 18,
        overseasSlotsMax: 8,
        passcode: passcodes[i],
      },
    })
  }

  // One insert, not one round trip per player — the pool is ~170 rows.
  await prisma.player.createMany({ data: poolPlayerRows(roomId) })

  return { teamNames, passcodes }
}

export async function seed(prisma: PrismaClient, roomName: string = DEFAULT_ROOM_NAME) {
  // Team seat PINs plus one extra for the auctioneer, drawn from the same
  // distinct pool so the admin PIN can never collide with a seat's.
  const officialTeamCount = Object.keys(TEAM_META).length
  const [adminPasscode, ...reservedTeamPasscodes] = generatePasscodes(officialTeamCount + 1)

  const room = await prisma.auctionRoom.create({
    data: {
      name: roomName.trim() || DEFAULT_ROOM_NAME,
      code: generateRoomCode(),
      phase: 'SETUP',
      adminPasscode,
    },
  })

  const { teamNames, passcodes } = await seedInto(prisma, room.id, reservedTeamPasscodes)

  console.log(`\n${room.name}  [${room.code}]`)
  console.log(`  ADMIN ${adminPasscode}  auctioneer's console`)
  console.log('  — team seat PINs, hand one to each table —')
  for (const [i, teamName] of teamNames.entries()) {
    console.log(`  ${TEAM_META[teamName].code.padEnd(5)} ${passcodes[i]}  ${teamName}`)
  }
  console.log()

  return room
}

if (require.main === module) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })
  // npx prisma db seed -- "Saturday 10am — Batch A"
  seed(prisma, process.argv.slice(2).join(' ') || DEFAULT_ROOM_NAME)
    .then((room) => {
      console.log(`Room id: ${room.id}`)
      return prisma.$disconnect()
    })
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
      process.exit(1)
    })
}
