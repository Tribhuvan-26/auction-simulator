import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { attachDatabasePool } from '@vercel/functions'
import { Pool } from 'pg'

// Dev keeps the client across hot reloads; it remembers which URL built it, so
// editing DATABASE_URL in .env takes effect without restarting `next dev`.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaUrl?: string }

function createPrismaClient() {
  // Supabase's free pooler caps clients at 200 across every function instance.
  // Bursts used to come from every screen refetching after every bid (pg's
  // default of 10 failed at ~20 instances). Broadcasts now carry the new state,
  // so one action builds one snapshot; 3 lets its reads overlap instead of
  // queueing on a single connection, while still leaving ~60 instances of room.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 5_000 })
  // Closes idle connections before Vercel suspends the instance, so sleeping
  // instances don't keep holding slots.
  attachDatabasePool(pool)
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

const cached = globalForPrisma.prismaUrl === process.env.DATABASE_URL ? globalForPrisma.prisma : undefined
export const prisma = cached ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaUrl = process.env.DATABASE_URL
}
