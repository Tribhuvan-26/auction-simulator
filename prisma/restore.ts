// Repopulate rooms whose teams/players were wiped but whose room row survived,
// and reset their admin PIN to a plain 4-digit code (the app compares PINs as
// plain text — see src/lib/pin-actions.ts).
//
//   npx tsx --env-file=.env prisma/restore.ts ROOM1 ROOM2
//   npx tsx --env-file=.env prisma/restore.ts ROOM1 --prune   # also delete empty rooms
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { generatePasscodes, seedInto } from './seed'

const OFFICIAL_TEAM_COUNT = 10

async function main() {
  const args = process.argv.slice(2)
  const prune = args.includes('--prune')
  const codes = args.filter((a) => !a.startsWith('--'))
  if (codes.length === 0) throw new Error('Pass the room codes to restore, e.g. ROOM1 ROOM2')

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

  for (const code of codes) {
    const room = await prisma.auctionRoom.findUnique({
      where: { code },
      select: { id: true, name: true, _count: { select: { teams: true } } },
    })
    if (!room) {
      console.log(`${code}  no such room — skipped`)
      continue
    }
    if (room._count.teams > 0) {
      console.log(`${code}  already has ${room._count.teams} teams — skipped`)
      continue
    }

    const [adminPasscode, ...teamPasscodes] = generatePasscodes(OFFICIAL_TEAM_COUNT + 1)
    await prisma.auctionRoom.update({ where: { id: room.id }, data: { adminPasscode } })
    const { teamNames, passcodes } = await seedInto(prisma, room.id, teamPasscodes)

    console.log(`\n${room.name}  [${code}]`)
    console.log(`  ADMIN ${adminPasscode}`)
    for (const [i, teamName] of teamNames.entries()) console.log(`  ${passcodes[i]}  ${teamName}`)
  }

  if (prune) {
    const { count } = await prisma.auctionRoom.deleteMany({
      where: { code: { notIn: codes }, teams: { none: {} }, players: { none: {} } },
    })
    console.log(`\nPruned ${count} empty rooms.`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
