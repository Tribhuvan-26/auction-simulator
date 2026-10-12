# Auction Live-This project is my child make sure good care is taken of it

![IPL Auction landing page](landing%20page.png)

Foundation for a real-time IPL-style auction platform (Next.js + Prisma + Supabase Realtime).

## Local dev setup

```bash
npm install
docker compose up -d db
npx prisma migrate dev
npx prisma db seed
```

Then:

```bash
npm run dev  # http://localhost:3000
```

## Other scripts

```bash
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run lint       # eslint
npm run build      # next build
```

Copy `.env.example` to `.env` and adjust `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (live updates go through Supabase Realtime, so these always point at the Supabase project).

## Architecture

Full teardown of the system, in nine parts: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
