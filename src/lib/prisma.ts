import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { attachDatabasePool } from '@vercel/functions'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  // Supabase's free pooler caps clients at 200 across every function instance.
  // pg's default of 10 per instance hit that cap at ~20 instances under a burst
  // of snapshot refetches; 3 still runs the snapshot's reads with little queueing.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 5_000 })
  // Closes idle connections before Vercel suspends the instance, so sleeping
  // instances don't keep holding slots.
  attachDatabasePool(pool)
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
