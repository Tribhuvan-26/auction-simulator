// Move a room that's already under way onto the current room rules, keeping
// every sale: 100 Cr purse (minus what each team has spent), 12-player squads,
// 4 overseas, rule base prices for players still to come, and the role order
// (batters, bowlers, all-rounders, keepers) for the queue. Lots already called
// are left as they are. Use prisma/reset-room.ts instead to start over.
//
//   npx tsx --env-file=.env prisma/apply-room-rules.ts ROOM1
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { basePriceFor, OVERSEAS_MAX, PURSE_TOTAL, ratingFor, ROLE_ORDER, SQUAD_SIZE } from '../src/lib/team-rules'

async function main() {
  const codes = process.argv.slice(2)
  if (codes.length === 0) throw new Error('Pass the room codes, e.g. ROOM1')
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

  for (const code of codes) {
    const room = await prisma.auctionRoom.findUnique({ where: { code }, select: { id: true, name: true } })
    if (!room) {
      console.log(`${code}  no such room — skipped`)
      continue
    }
    await prisma.$transaction(
      async (tx) => {
        const teams = await tx.team.findMany({ where: { roomId: room.id }, include: { players: true } })
        for (const t of teams) {
          const spent = t.players.reduce((n, p) => n + (p.soldPrice ?? 0), 0)
          const overseas = t.players.filter((p) => p.isOverseas).length
          if (spent > PURSE_TOTAL || t.players.length > SQUAD_SIZE || overseas > OVERSEAS_MAX) {
            console.log(`  ${t.shortCode}: already over the new limits (${t.players.length} players, ${overseas} overseas) — check by hand`)
          }
          await tx.team.update({
            where: { id: t.id },
            data: {
              purseTotal: PURSE_TOTAL,
              purseRemaining: PURSE_TOTAL - spent,
              squadMax: SQUAD_SIZE,
              squadMin: SQUAD_SIZE - 1,
              overseasSlotsMax: OVERSEAS_MAX,
              overseasSlotsUsed: overseas,
            },
          })
        }

        const upcoming = await tx.player.findMany({
          where: { roomId: room.id, status: 'UPCOMING' },
          orderBy: [{ queueOrder: 'asc' }, { id: 'asc' }],
        })
        const ordered = [...upcoming].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
        for (const [i, p] of ordered.entries()) {
          const category = p.isOverseas ? 'Overseas' : p.setNumber === 'Uncapped Players' ? 'Uncapped' : 'Capped'
          await tx.player.update({
            where: { id: p.id },
            data: { queueOrder: i, basePrice: basePriceFor(category, ratingFor(p.name) ?? 0) },
          })
        }
        console.log(`${room.name}  [${code}]  ${teams.length} teams on 100 Cr / 12 / 4, ${upcoming.length} upcoming players re-priced and re-ordered`)
      },
      { timeout: 60_000 }
    )
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
