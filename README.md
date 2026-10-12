# Auction Live

> This project is my child — make sure good care is taken of it.

![IPL Auction landing page](landing%20page.png)

A real-time **IPL-style mock player auction** for a live room full of people. One auctioneer runs the
room, ten franchise seats bid from their own phones, and a projector screen shows the lot as it
happens. Live at **[auction.mlritcie.in](https://auction.mlritcie.in)**.

## How it works

| Seat | Route | What it does |
|---|---|---|
| **Auctioneer** | `/admin/[roomId]` | Loads the next player, raises bids for teams, runs the timer, calls sold/unsold, undoes mistakes. Keys: <kbd>Space</kbd> pause, <kbd>S</kbd> sold, <kbd>U</kbd> unsold, <kbd>Z</kbd> undo |
| **Team seat** | `/team/[roomId]/[teamId]` | One per franchise, PIN-protected. Purse, 25-slot squad, overseas count, and one big Bid button showing the single legal next amount |
| **Big screen** | `/display/[roomId]` | Player photo, live bid, countdown ring, current holder, and a SOLD slam with a 3D gavel and confetti |
| **Landing** | `/` | Animated intro and room directory with links to every seat |

**The loop:** load a player at base price → teams bid up the ladder → auctioneer calls it → a sale
debits the purse, adds the player to the squad, and uses an overseas slot, all in one transaction.

- **254 real IPL 2026 players** across all 10 franchises (CSK, DC, GT, KKR, LSG, MI, PBKS, RCB, RR, SRH), ₹120 Cr purse each
- **Bid ladder:** +5 L under 1 Cr, +10 L under 2 Cr, +20 L under 5 Cr, +25 L above. Purse, squad and overseas limits are checked on the server too
- **Realtime:** Supabase Realtime pushes a notification on every bid or sale, and every screen re-reads Postgres, so all screens stay in sync
- **Rooms:** several auctions can run at once, each fully isolated

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · PostgreSQL on Supabase via Prisma 7 ·
Supabase Realtime · Tailwind v4 · GSAP, Framer Motion & three.js (Blender-built 3D models) ·
Vitest · deployed on Vercel.

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
