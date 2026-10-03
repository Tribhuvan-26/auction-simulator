import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Plain process.env, not prisma's env() helper: that throws when unset, which
    // breaks `prisma generate` on builders that have no DATABASE_URL. Commands that need a real URL fail on
    // connect instead, which is a clearer error anyway.
    url: process.env.DATABASE_URL ?? '',
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
