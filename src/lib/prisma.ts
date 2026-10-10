import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { attachDatabasePool } from '@vercel/functions'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  // Supabase's free pooler caps clients at 200 across every function instance.
  // A burst of snapshot refetches fans out to dozens of instances: pg's default
  // of 10 each failed at ~20 instances, 3 each still failed 15% of a load test.
  // One connection serialises the snapshot's reads, but in-region they take a
  // few ms each. Safe only while no code queries the global client from inside
  // a $transaction callback — that would wait on the connection it holds.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, idleTimeoutMillis: 5_000 })
  // Closes idle connections before Vercel suspends the instance, so sleeping
  // instances don't keep holding slots.
  attachDatabasePool(pool)
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
