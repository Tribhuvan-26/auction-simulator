# Onboarding — Auction Live

Real-time IPL-style auction platform. Next.js 16 (App Router, Server Actions) + Prisma/Postgres + Socket.io, styled as a "Neo-Grid" brutalist design system.

## 1. Accounts you need

- **GitHub** — access to `Tribhuvan-26/auction-simulator`. Ask the owner to add you as a collaborator.
- **Railway** (only if you'll touch deployment) — ask to be invited as a project member on `auction-live`. Don't ask for raw env values pasted around; an invite gives you scoped, revocable access instead.
- **Supabase** (only if you'll touch production data directly) — same idea, ask for a project invite rather than a copied connection string.

For day-to-day feature work you don't need Railway or Supabase access at all — local dev runs against your own local Postgres.

## 2. Tools to install

- **Node.js** 22.x (or 20.x LTS)
- **Docker Desktop** — runs local Postgres via `docker-compose.yml`
- **Git**
- A terminal that can keep two processes running side by side (the Next.js app and the Socket.io server are separate)

## 3. One-time setup

```bash
git clone https://github.com/Tribhuvan-26/auction-simulator.git
cd auction-simulator
npm install --legacy-peer-deps   # see note below on why --legacy-peer-deps
cp .env.example .env             # defaults already match docker-compose, no real secrets needed
docker compose up -d db
npx prisma migrate dev
npx prisma db seed
```

> **Why `--legacy-peer-deps`:** `vitest@5` peer-requires `@types/node@^22`, but the repo pins `@types/node@^20`. Plain `npm ci`/`npm install` fails with an ERESOLVE error. This is a known, live issue (CI uses the same flag) — not something you're doing wrong.

## 4. Running it day to day

Two terminals:
```bash
npm run dev            # Next.js app       → http://localhost:3000
npm run socket-server  # Socket.io server  → http://localhost:4000
```

`npx prisma db seed` prints PIN codes for the admin console and each team seat when it runs — that's how you get into a room locally.

## 5. Before you commit

```bash
npm run typecheck
npm test
npm run lint
```
All three run in CI on every push/PR to `main` too (see below), but running them locally first saves a round trip.

## 6. Git workflow

- Branch off `main`, open a PR — nothing here is a git-flow/trunk mandate beyond that, just don't push straight to `main` for anything non-trivial.
- **CI runs automatically** on push/PR to `main` (`.github/workflows/ci.yml`): spins up a real Postgres, runs migrations, then typecheck → test → lint → build. One of the test files (`actions.test.ts`) hits a live DB, not mocks, which is why CI provisions one.
- If CI is green on `main`, **deploy runs automatically too** (`.github/workflows/deploy.yml`) — pushes both the `web` and `socket` Railway services. You don't need to run `railway up` by hand unless you're debugging deploy itself.

## 7. Where things live

| What | Where |
|---|---|
| Local env config | `.env` (gitignored, never commit) |
| Production DB creds | `.env.production.local` (gitignored — Supabase, don't share raw) |
| Env var template | `.env.example` — copy this, it's all you need locally |
| System architecture | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — full nine-part teardown |
| Non-standard Next.js notes | [`AGENTS.md`](AGENTS.md) — this repo's Next.js build has breaking changes from what you may know; read before writing Next.js-specific code |
| Team crest artwork | `public/logos/*.svg` — official franchise logos, already licensed for this project. Don't add more without checking licensing first. |
| Deploy config | `.github/workflows/` (CI + deploy) — no Vercel, no other host. Railway hosts both the app and the socket server; Supabase is the DB. |

## 8. Architecture in one paragraph

Next.js Server Actions do all the writes (bids, sold/unsold, timer control) straight to Postgres via Prisma. After a successful write, the action pings a standalone Socket.io server, which rebroadcasts a lightweight event to everyone else in that room. Clients react to the event by refetching a fresh snapshot from the server — not by trusting the socket payload as truth. Three UI surfaces (admin console, team console, display board) all render from the same snapshot shape. Full detail in `docs/ARCHITECTURE.md`.
