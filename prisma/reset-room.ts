// Start a room's auction over: wipe its bids, lots and players, refill every
// purse, reload the current pool (prisma/data/auction-pool.json) and put the
// room back in SETUP. The room code, team seats and every PIN stay as they
// are, so the printed access sheet still works. Sale history is gone for good.
//
//   npx tsx --env-file=.env prisma/reset-room.ts ROOM1
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { poolPlayerRows } from './seed'

async function main() {
  const codes = process.argv.slice(2)
  if (codes.length === 0) throw new Error('Pass the room codes to reset, e.g. ROOM1')

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

  for (const code of codes) {
    const room = await prisma.auctionRoom.findUnique({ where: { code }, select: { id: true, name: true } })
    if (!room) {
      console.log(`${code}  no such room — skipped`)
      continue
    }

    const players = await prisma.$transaction(
      async (tx) => {
        await tx.bid.deleteMany({ where: { lot: { roomId: room.id } } })
        await tx.auctionLot.deleteMany({ where: { roomId: room.id } })
        await tx.player.deleteMany({ where: { roomId: room.id } })
        const teams = await tx.team.findMany({ where: { roomId: room.id }, select: { id: true, purseTotal: true } })
        for (const t of teams) {
          await tx.team.update({ where: { id: t.id }, data: { purseRemaining: t.purseTotal, overseasSlotsUsed: 0 } })
        }
        const { count } = await tx.player.createMany({ data: poolPlayerRows(room.id) })
        await tx.auctionRoom.update({ where: { id: room.id }, data: { phase: 'SETUP', round: 1 } })
        return count
      },
      { timeout: 60_000 }
    )

    console.log(`${room.name}  [${code}]  reset: ${players} players, purses refilled, PINs unchanged`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
