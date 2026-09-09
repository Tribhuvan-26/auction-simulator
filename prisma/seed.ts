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

/**
 * Seeds one room. Several sessions can run at once, so name each one — the
 * landing page lists every room and the name is all an operator has to tell
 * them apart when pointing people to their seats.
 */
export async function seed(prisma: PrismaClient, roomName: string = DEFAULT_ROOM_NAME) {
  const officialPlayers = loadOfficialPlayers()
  const rolesByName = loadRoles()
  const unroled = officialPlayers.filter((p) => !rolesByName[p.name]).map((p) => p.name)
  if (unroled.length) throw new Error(`No role in player-roles.json for: ${unroled.join(', ')}`)
  const teamNames = [...new Set(officialPlayers.map((p) => p.team))]

  // One extra PIN for the auctioneer, distinct from every seat's so a table
  // can't wander into the console with the PIN it was handed.
  const [adminPasscode, ...passcodes] = generatePasscodes(teamNames.length + 1)

  const room = await prisma.auctionRoom.create({
    data: { name: roomName.trim() || DEFAULT_ROOM_NAME, phase: 'SETUP', adminPasscode },
  })

  const teamIdByName = new Map<string, string>()
  for (const [i, teamName] of teamNames.entries()) {
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
        passcode: passcodes[i],
      },
    })
    teamIdByName.set(teamName, team.id)
  }

  console.log(`\n${room.name}`)
  console.log(`  ADMIN ${adminPasscode}  auctioneer's console`)
  console.log('  — team seat PINs, hand one to each table —')
  for (const [i, teamName] of teamNames.entries()) {
    console.log(`  ${TEAM_META[teamName].code.padEnd(5)} ${passcodes[i]}  ${teamName}`)
  }
  console.log()

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
