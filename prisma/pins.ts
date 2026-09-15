import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/** Print the PINs that live in THIS machine's database. Seed PINs are random
 * per seed run, so a teammate's clone has different ones than yours. */
async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })
  const rooms = await prisma.auctionRoom.findMany({
    orderBy: { name: 'asc' },
    include: { teams: { orderBy: { name: 'asc' }, select: { name: true, shortCode: true, passcode: true } } },
  })
  if (rooms.length === 0) console.log('No rooms. Run: npx prisma db seed')
  for (const room of rooms) {
    console.log(`\n${room.name}  [${room.code}]`)
    console.log(`  ADMIN ${room.adminPasscode || '(none — reseed this room)'}`)
    for (const team of room.teams) console.log(`  ${(team.shortCode ?? '').padEnd(5)} ${team.passcode}  ${team.name}`)
  }
  console.log()
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
