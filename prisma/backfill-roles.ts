// One-off: apply prisma/data/player-roles.json to rooms that were seeded
// before roles were curated (they got round-robin placeholders).
//   npx tsx -r dotenv/config prisma/backfill-roles.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient, PlayerRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

async function main() {
  const roles: Record<string, PlayerRole> = JSON.parse(
    readFileSync(join(__dirname, 'data/player-roles.json'), 'utf-8')
  )
  let updated = 0
  for (const [name, role] of Object.entries(roles)) {
    const { count } = await prisma.player.updateMany({ where: { name, role: { not: role } }, data: { role } })
    updated += count
  }
  console.log(`updated ${updated} player rows`)
}

main().finally(() => prisma.$disconnect())
