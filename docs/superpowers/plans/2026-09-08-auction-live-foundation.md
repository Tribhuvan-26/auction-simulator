# Auction Live — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the shared foundation for "Auction Live" — Next.js 14 app scaffold, Postgres/Prisma data model, a standalone Socket.io realtime service, Zustand client store, and the brutalist design-token base — so the three interface plans (Admin, Team, Display) can each be built on top of a working, tested skeleton.

**Architecture:** Next.js 14 App Router + TypeScript owns pages/API; Prisma + Postgres is the durable source of truth; a standalone Node process runs Socket.io (Next serverless can't hold long-lived sockets) and is the only thing that broadcasts realtime state; Zustand holds client-side auction state and is updated exclusively from socket events. Brand tokens live as CSS variables consumed by Tailwind.

**Tech Stack:** Next.js 14 (App Router, TS), Tailwind CSS, Prisma + PostgreSQL, Socket.io + socket.io-client, Zustand, Vitest + @testing-library/react, next/font (Space Grotesk, Inter).

**Spec:** `C:\Users\aishw\Downloads\auction-website-prd.md`

## Global Constraints

- Brand palette, exact hexes, no substitutions: Primary Blue `#2074D5`, Warm Yellow `#F9D47B`, Punch Pink `#EB547C`, White `#FFFFFF`, Charcoal `#282828`.
- Fonts: Space Grotesk (headings/numbers, tabular-nums mandatory on bid figures) + Inter (body), loaded via `next/font/google`.
- Cards: 2–3px solid charcoal borders, hard-offset shadows (e.g. `4px 4px 0 #282828`, zero blur) — never blur/glassmorphism.
- Realtime must run on a standalone Node/Socket.io process, not a Next.js serverless function.
- Every auction state transition must persist to Postgres via Prisma — state must survive a server restart mid-auction.
- Seed data: 8 teams, 40 players across roles (Batter/Bowler/AllRounder/WicketKeeper) and sets.

---

## File Structure

```
auction simulator/
  package.json, tsconfig.json, next.config.js, tailwind.config.ts, postcss.config.js
  vitest.config.ts
  .env, .env.example
  docker-compose.yml                 # local Postgres for dev/test
  prisma/
    schema.prisma
    seed.ts
  src/
    app/
      layout.tsx
      page.tsx
      globals.css
    components/ui/
      brutal-card.tsx
      brutal-card.test.tsx
    lib/
      prisma.ts                      # Prisma client singleton
      fonts.ts                       # next/font exports
    stores/
      auction-store.ts               # Zustand store mirroring AuctionRoom/AuctionLot
      auction-store.test.ts
    hooks/
      use-auction-socket.ts          # connects Next client to socket server, feeds store
      use-auction-socket.test.ts
  server/
    socket-server.ts                 # standalone Socket.io process
    socket-server.test.ts
```

---

### Task 1: Project Init & Tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `.gitignore`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: a runnable `npm run dev` (Next.js) and `npm test` (Vitest) command for all later tasks.

- [ ] **Step 1: Scaffold Next.js + TypeScript**

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

Answer prompts to match: App Router yes, `src/` yes, import alias `@/*`.

- [ ] **Step 2: Add remaining runtime dependencies**

```bash
npm install socket.io socket.io-client zustand @prisma/client
npm install -D prisma vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom tsx
```

- [ ] **Step 3: Configure Vitest**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Verify the toolchain boots**

Run: `npm run dev` — expected: dev server starts on `http://localhost:3000` with the default Next.js page (Ctrl+C to stop).
Run: `npm test` — expected: "No test files found" (passes with 0 tests, not an error).

- [ ] **Step 5: Init git and commit**

```bash
git init
git add package.json package-lock.json tsconfig.json next.config.js vitest.config.ts vitest.setup.ts .gitignore src
git commit -m "chore: scaffold Next.js 14 + TypeScript + Vitest"
```

---

### Task 2: Brand Tokens & Typography

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`
- Create: `src/lib/fonts.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: Tailwind color tokens `brand-blue`, `brand-yellow`, `brand-pink`, `brand-white`, `brand-charcoal`; CSS variables `--font-heading`, `--font-body`; a `shadow-brutal` and `shadow-brutal-pressed` utility.

- [ ] **Step 1: Define CSS variables**

```css
/* src/app/globals.css — add to :root, keep existing Tailwind directives above */
:root {
  --color-blue: #2074D5;
  --color-yellow: #F9D47B;
  --color-pink: #EB547C;
  --color-white: #FFFFFF;
  --color-charcoal: #282828;
}
```

- [ ] **Step 2: Wire tokens + brutalist shadow utilities into Tailwind**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-blue': 'var(--color-blue)',
        'brand-yellow': 'var(--color-yellow)',
        'brand-pink': 'var(--color-pink)',
        'brand-white': 'var(--color-white)',
        'brand-charcoal': 'var(--color-charcoal)',
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
      },
      boxShadow: {
        brutal: '4px 4px 0 #282828',
        'brutal-pressed': '1px 1px 0 #282828',
      },
    },
  },
} satisfies Config
```

- [ ] **Step 3: Load fonts via next/font**

```typescript
// src/lib/fonts.ts
import { Space_Grotesk, Inter } from 'next/font/google'

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-heading',
})

export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
})
```

```tsx
// src/app/layout.tsx
import { spaceGrotesk, inter } from '@/lib/fonts'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="font-body bg-brand-white text-brand-charcoal">{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev`, open `http://localhost:3000` — expected: page renders with Inter body font applied (no console font-loading errors). This is config-only, so a rendered check stands in for a unit test.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx tailwind.config.ts src/lib/fonts.ts
git commit -m "feat: brand palette tokens, brutalist shadows, Space Grotesk/Inter fonts"
```

---

### Task 3: BrutalCard Base Component

**Files:**
- Create: `src/components/ui/brutal-card.tsx`
- Test: `src/components/ui/brutal-card.test.tsx`

**Interfaces:**
- Consumes: Tailwind tokens from Task 2 (`shadow-brutal`, `border-brand-charcoal`).
- Produces: `BrutalCard` component — `{ variant?: 'default' | 'active' | 'sold' | 'unsold' | 'pressed', className?: string, children: React.ReactNode }`. Later tasks (all three interfaces) import this as the base card primitive.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/brutal-card.test.tsx
import { render, screen } from '@testing-library/react'
import { BrutalCard } from './brutal-card'

describe('BrutalCard', () => {
  it('renders children with the default brutalist border and shadow', () => {
    render(<BrutalCard>Hello</BrutalCard>)
    const card = screen.getByText('Hello')
    expect(card).toHaveClass('border-brand-charcoal')
    expect(card).toHaveClass('shadow-brutal')
  })

  it('applies the pressed variant with a shrunk shadow and no blur', () => {
    render(<BrutalCard variant="pressed">Pressed</BrutalCard>)
    expect(screen.getByText('Pressed')).toHaveClass('shadow-brutal-pressed')
  })

  it('applies the sold variant with a yellow-accented border', () => {
    render(<BrutalCard variant="sold">Sold</BrutalCard>)
    expect(screen.getByText('Sold')).toHaveClass('border-brand-yellow')
  })

  it('applies the unsold variant with a desaturated fill', () => {
    render(<BrutalCard variant="unsold">Unsold</BrutalCard>)
    expect(screen.getByText('Unsold')).toHaveClass('bg-brand-white/60')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- brutal-card` — expected: FAIL, "Cannot find module './brutal-card'".

- [ ] **Step 3: Implement BrutalCard**

```tsx
// src/components/ui/brutal-card.tsx
import { cn } from '@/lib/cn'

type BrutalCardVariant = 'default' | 'active' | 'sold' | 'unsold' | 'pressed'

const variantClasses: Record<BrutalCardVariant, string> = {
  default: 'border-brand-charcoal shadow-brutal bg-brand-white',
  active: 'border-brand-blue shadow-brutal bg-brand-white',
  sold: 'border-brand-yellow shadow-brutal bg-brand-white',
  unsold: 'border-brand-charcoal shadow-brutal bg-brand-white/60',
  pressed: 'border-brand-charcoal shadow-brutal-pressed bg-brand-white translate-x-[3px] translate-y-[3px]',
}

export function BrutalCard({
  variant = 'default',
  className,
  children,
}: {
  variant?: BrutalCardVariant
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('border-2 rounded-none p-4', variantClasses[variant], className)}>
      {children}
    </div>
  )
}
```

```typescript
// src/lib/cn.ts
export function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- brutal-card` — expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/brutal-card.tsx src/components/ui/brutal-card.test.tsx src/lib/cn.ts
git commit -m "feat: BrutalCard base primitive with variant tests"
```

---

### Task 4: Prisma Schema & Postgres

**Files:**
- Create: `prisma/schema.prisma`
- Create: `docker-compose.yml`
- Create: `.env`, `.env.example`
- Create: `src/lib/prisma.ts`

**Interfaces:**
- Produces: Prisma models `AuctionRoom`, `Team`, `Player`, `AuctionLot`, `Bid` and a shared `prisma` client singleton (`src/lib/prisma.ts` exports `prisma: PrismaClient`). Task 5 (seed) and later interface plans depend on these exact model/field names.

- [ ] **Step 1: Local Postgres via Docker Compose**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: auction
      POSTGRES_PASSWORD: auction
      POSTGRES_DB: auction_live
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

```bash
# .env.example
DATABASE_URL="postgresql://auction:auction@localhost:5432/auction_live"
```

Copy `.env.example` to `.env` (gitignored).

- [ ] **Step 2: Write the schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum PlayerRole {
  BATTER
  BOWLER
  ALL_ROUNDER
  WICKET_KEEPER
}

enum PlayerStatus {
  UPCOMING
  LIVE
  SOLD
  UNSOLD
}

enum RoomPhase {
  SETUP
  LIVE
  PAUSED
  COMPLETED
}

enum LotStatus {
  QUEUED
  BIDDING
  SOLD
  UNSOLD
}

model AuctionRoom {
  id           String       @id @default(cuid())
  name         String
  phase        RoomPhase    @default(SETUP)
  round        Int          @default(1)
  currentLotId String?
  createdAt    DateTime     @default(now())
  teams        Team[]
  players      Player[]
  lots         AuctionLot[]
}

model Team {
  id                String       @id @default(cuid())
  roomId            String
  room              AuctionRoom  @relation(fields: [roomId], references: [id])
  name              String
  shortCode         String
  logoUrl           String?
  colorAccent       String       @default("#2074D5")
  purseTotal        Int
  purseRemaining    Int
  squadMax          Int
  squadMin          Int
  overseasSlotsMax  Int
  overseasSlotsUsed Int          @default(0)
  players           Player[]
  bids              Bid[]
}

model Player {
  id          String       @id @default(cuid())
  roomId      String
  room        AuctionRoom  @relation(fields: [roomId], references: [id])
  name        String
  role        PlayerRole
  basePrice   Int
  photoUrl    String?
  nationality String
  isOverseas  Boolean      @default(false)
  matches     Int
  runs        Int?
  wickets     Int?
  average     Float?
  strikeRate  Float?
  economy     Float?
  status      PlayerStatus @default(UPCOMING)
  setNumber   String
  soldPrice   Int?
  teamId      String?
  team        Team?        @relation(fields: [teamId], references: [id])
  lot         AuctionLot?
}

model AuctionLot {
  id                    String      @id @default(cuid())
  roomId                String
  room                  AuctionRoom @relation(fields: [roomId], references: [id])
  playerId              String      @unique
  player                Player      @relation(fields: [playerId], references: [id])
  currentBid            Int
  currentBiddingTeamId  String?
  status                LotStatus   @default(QUEUED)
  timerSeconds          Int         @default(30)
  bids                  Bid[]
}

model Bid {
  id        String     @id @default(cuid())
  lotId     String
  lot       AuctionLot @relation(fields: [lotId], references: [id])
  teamId    String
  team      Team       @relation(fields: [teamId], references: [id])
  amount    Int
  timestamp DateTime   @default(now())
}
```

- [ ] **Step 2: Prisma client singleton**

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Start Postgres and run the migration**

Run: `docker compose up -d db`
Run: `npx prisma migrate dev --name init`
Expected: migration applies cleanly, `prisma/migrations/` gets a new folder, no errors.

- [ ] **Step 4: Verify the schema is valid**

Run: `npx prisma validate` — expected: "The schema is valid".

- [ ] **Step 5: Commit**

```bash
git add prisma docker-compose.yml .env.example .gitignore src/lib/prisma.ts
git commit -m "feat: Prisma schema for auction domain model + local Postgres compose"
```

---

### Task 5: Seed Script

**Files:**
- Create: `prisma/seed.ts`
- Test: `prisma/seed.test.ts`
- Modify: `package.json` (add `prisma.seed` config)

**Interfaces:**
- Consumes: `prisma` client from Task 4.
- Produces: `npx prisma db seed` populates one `AuctionRoom` with exactly 8 `Team` rows and 40 `Player` rows spread across all 4 roles and at least 2 distinct `setNumber` values. Later interface plans rely on this fixture room existing for manual/dev testing.

- [ ] **Step 1: Write the failing test**

```typescript
// prisma/seed.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { seed } from './seed'

const prisma = new PrismaClient()

describe('seed', () => {
  let roomId: string

  beforeAll(async () => {
    const room = await seed(prisma)
    roomId = room.id
  })

  afterAll(async () => {
    await prisma.bid.deleteMany({})
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.team.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
    await prisma.$disconnect()
  })

  it('creates exactly 8 teams', async () => {
    const teams = await prisma.team.findMany({ where: { roomId } })
    expect(teams).toHaveLength(8)
  })

  it('creates exactly 40 players', async () => {
    const players = await prisma.player.findMany({ where: { roomId } })
    expect(players).toHaveLength(40)
  })

  it('covers all four player roles', async () => {
    const players = await prisma.player.findMany({ where: { roomId } })
    const roles = new Set(players.map((p) => p.role))
    expect(roles).toEqual(new Set(['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']))
  })

  it('spreads players across at least two sets', async () => {
    const players = await prisma.player.findMany({ where: { roomId } })
    const sets = new Set(players.map((p) => p.setNumber))
    expect(sets.size).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- prisma/seed` — expected: FAIL, "Cannot find module './seed'".

- [ ] **Step 3: Implement the seed function**

```typescript
// prisma/seed.ts
import { PrismaClient, PlayerRole } from '@prisma/client'

const TEAM_NAMES = [
  ['Mumbai Monarchs', 'MUM'], ['Chennai Chargers', 'CHE'], ['Delhi Daredevils', 'DEL'],
  ['Bangalore Blazers', 'BLR'], ['Kolkata Knights', 'KOL'], ['Hyderabad Hawks', 'HYD'],
  ['Punjab Panthers', 'PUN'], ['Rajasthan Royals2', 'RAJ'],
] as const

const ROLES: PlayerRole[] = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']
const SETS = ['Marquee Set', 'Set 2 - Pacers', 'Set 3 - Spinners', 'Set 4 - Uncapped']

export async function seed(prisma: PrismaClient) {
  const room = await prisma.auctionRoom.create({
    data: { name: 'Demo Auction', phase: 'SETUP' },
  })

  for (const [name, shortCode] of TEAM_NAMES) {
    await prisma.team.create({
      data: {
        roomId: room.id,
        name,
        shortCode,
        purseTotal: 10000,
        purseRemaining: 10000,
        squadMax: 25,
        squadMin: 18,
        overseasSlotsMax: 8,
      },
    })
  }

  for (let i = 0; i < 40; i++) {
    await prisma.player.create({
      data: {
        roomId: room.id,
        name: `Player ${i + 1}`,
        role: ROLES[i % ROLES.length],
        basePrice: 20 + (i % 5) * 10,
        nationality: i % 3 === 0 ? 'Overseas' : 'India',
        isOverseas: i % 3 === 0,
        matches: 50 + i,
        setNumber: SETS[i % SETS.length],
      },
    })
  }

  return room
}

if (require.main === module) {
  const prisma = new PrismaClient()
  seed(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
      process.exit(1)
    })
}
```

Add to `package.json`:
```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- prisma/seed` — expected: PASS, 4 tests (requires `docker compose up -d db` running and migration applied from Task 4).

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts prisma/seed.test.ts package.json
git commit -m "feat: seed script for 8 teams / 40 players demo dataset"
```

---

### Task 6: Zustand Auction Store

**Files:**
- Create: `src/stores/auction-store.ts`
- Test: `src/stores/auction-store.test.ts`

**Interfaces:**
- Produces: `useAuctionStore` Zustand hook exposing state `{ room: RoomState | null }` and actions `setRoom(room: RoomState)`, `applyBid(bid: { teamId: string; amount: number }): void`, `markSold(): void`, `markUnsold(): void`, `undoLastBid(): void`. `RoomState` type (exported) is `{ id: string; phase: string; currentLot: LotState | null; teams: TeamState[] }`; `LotState` is `{ id: string; playerId: string; currentBid: number; currentBiddingTeamId: string | null; status: string; bidHistory: { teamId: string; amount: number; timestamp: string }[] }`. Later socket hook (Task 8) and all three interface plans consume this exact shape.

- [ ] **Step 1: Write the failing test**

```typescript
// src/stores/auction-store.test.ts
import { useAuctionStore } from './auction-store'
import type { RoomState } from './auction-store'

const baseRoom: RoomState = {
  id: 'room-1',
  phase: 'LIVE',
  currentLot: {
    id: 'lot-1',
    playerId: 'player-1',
    currentBid: 100,
    currentBiddingTeamId: null,
    status: 'BIDDING',
    bidHistory: [],
  },
  teams: [{ id: 'team-1', name: 'Mumbai Monarchs', purseRemaining: 10000 }],
}

describe('auction-store', () => {
  beforeEach(() => {
    useAuctionStore.getState().setRoom(baseRoom)
  })

  it('applies a bid, updating currentBid, bidder, and bid history', () => {
    useAuctionStore.getState().applyBid({ teamId: 'team-1', amount: 150 })
    const { currentLot } = useAuctionStore.getState().room!
    expect(currentLot!.currentBid).toBe(150)
    expect(currentLot!.currentBiddingTeamId).toBe('team-1')
    expect(currentLot!.bidHistory).toHaveLength(1)
  })

  it('marks the lot sold', () => {
    useAuctionStore.getState().markSold()
    expect(useAuctionStore.getState().room!.currentLot!.status).toBe('SOLD')
  })

  it('marks the lot unsold', () => {
    useAuctionStore.getState().markUnsold()
    expect(useAuctionStore.getState().room!.currentLot!.status).toBe('UNSOLD')
  })

  it('undoes the last bid by popping bid history and recomputing current bid', () => {
    useAuctionStore.getState().applyBid({ teamId: 'team-1', amount: 150 })
    useAuctionStore.getState().applyBid({ teamId: 'team-1', amount: 200 })
    useAuctionStore.getState().undoLastBid()
    const { currentLot } = useAuctionStore.getState().room!
    expect(currentLot!.currentBid).toBe(150)
    expect(currentLot!.bidHistory).toHaveLength(1)
  })

  it('undo on an empty bid history resets to the base bid without erroring', () => {
    useAuctionStore.getState().undoLastBid()
    const { currentLot } = useAuctionStore.getState().room!
    expect(currentLot!.currentBid).toBe(100)
    expect(currentLot!.bidHistory).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auction-store` — expected: FAIL, "Cannot find module './auction-store'".

- [ ] **Step 3: Implement the store**

```typescript
// src/stores/auction-store.ts
import { create } from 'zustand'

export type TeamState = { id: string; name: string; purseRemaining: number }
export type LotState = {
  id: string
  playerId: string
  currentBid: number
  currentBiddingTeamId: string | null
  status: string
  bidHistory: { teamId: string; amount: number; timestamp: string }[]
}
export type RoomState = {
  id: string
  phase: string
  currentLot: LotState | null
  teams: TeamState[]
}

type AuctionStore = {
  room: RoomState | null
  setRoom: (room: RoomState) => void
  applyBid: (bid: { teamId: string; amount: number }) => void
  markSold: () => void
  markUnsold: () => void
  undoLastBid: () => void
}

export const useAuctionStore = create<AuctionStore>((set) => ({
  room: null,

  setRoom: (room) => set({ room }),

  applyBid: ({ teamId, amount }) =>
    set((state) => {
      if (!state.room?.currentLot) return state
      const entry = { teamId, amount, timestamp: new Date().toISOString() }
      return {
        room: {
          ...state.room,
          currentLot: {
            ...state.room.currentLot,
            currentBid: amount,
            currentBiddingTeamId: teamId,
            bidHistory: [...state.room.currentLot.bidHistory, entry],
          },
        },
      }
    }),

  markSold: () =>
    set((state) => {
      if (!state.room?.currentLot) return state
      return { room: { ...state.room, currentLot: { ...state.room.currentLot, status: 'SOLD' } } }
    }),

  markUnsold: () =>
    set((state) => {
      if (!state.room?.currentLot) return state
      return { room: { ...state.room, currentLot: { ...state.room.currentLot, status: 'UNSOLD' } } }
    }),

  undoLastBid: () =>
    set((state) => {
      const lot = state.room?.currentLot
      if (!lot) return state
      const history = lot.bidHistory.slice(0, -1)
      const previous = history[history.length - 1]
      return {
        room: {
          ...state.room!,
          currentLot: {
            ...lot,
            bidHistory: history,
            currentBid: previous ? previous.amount : lot.currentBid,
            currentBiddingTeamId: previous ? previous.teamId : lot.currentBiddingTeamId,
          },
        },
      }
    }),
}))
```

Note: `undoLastBid` on an empty history keeps `currentBid` at whatever it already was (the base/current value) rather than guessing a prior amount — this matches the spec's "pop last entry, recompute state, never silently mutate" rule.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- auction-store` — expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/stores/auction-store.ts src/stores/auction-store.test.ts
git commit -m "feat: Zustand auction store with bid/sold/unsold/undo actions"
```

---

### Task 7: Standalone Socket.io Server

**Files:**
- Create: `server/socket-server.ts`
- Test: `server/socket-server.test.ts`
- Modify: `package.json` (add `"socket-server": "tsx server/socket-server.ts"` script)

**Interfaces:**
- Produces: `createSocketServer(port: number): http.Server` — starts a Socket.io server where clients `emit('room:join', roomId)` to join a room-scoped channel, and any client's `emit('auction:event', { roomId, payload })` is broadcast to every other client in that room as `on('auction:event', payload)`. Task 8's client hook connects using this exact event contract.

- [ ] **Step 1: Write the failing test**

```typescript
// server/socket-server.test.ts
import { io as ioClient, Socket } from 'socket.io-client'
import { createSocketServer } from './socket-server'
import type { Server as HttpServer } from 'http'

describe('socket-server', () => {
  let server: HttpServer
  let port: number
  let clientA: Socket
  let clientB: Socket

  beforeAll(async () => {
    server = createSocketServer(0)
    await new Promise<void>((resolve) => server.listen(() => resolve()))
    port = (server.address() as any).port
  })

  afterAll(() => {
    clientA?.close()
    clientB?.close()
    server.close()
  })

  it('broadcasts auction:event only to other clients in the same room', async () => {
    clientA = ioClient(`http://localhost:${port}`)
    clientB = ioClient(`http://localhost:${port}`)

    await Promise.all([
      new Promise<void>((resolve) => clientA.on('connect', () => resolve())),
      new Promise<void>((resolve) => clientB.on('connect', () => resolve())),
    ])

    clientA.emit('room:join', 'room-1')
    clientB.emit('room:join', 'room-1')
    await new Promise((resolve) => setTimeout(resolve, 50))

    const received = new Promise((resolve) => clientB.on('auction:event', resolve))
    clientA.emit('auction:event', { roomId: 'room-1', payload: { type: 'BID', amount: 150 } })

    expect(await received).toEqual({ type: 'BID', amount: 150 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- socket-server` — expected: FAIL, "Cannot find module './socket-server'".

- [ ] **Step 3: Implement the socket server**

```typescript
// server/socket-server.ts
import { createServer } from 'http'
import { Server } from 'socket.io'

export function createSocketServer(port: number) {
  const httpServer = createServer()
  const io = new Server(httpServer, { cors: { origin: '*' } })

  io.on('connection', (socket) => {
    socket.on('room:join', (roomId: string) => {
      socket.join(roomId)
    })

    socket.on('auction:event', ({ roomId, payload }: { roomId: string; payload: unknown }) => {
      socket.to(roomId).emit('auction:event', payload)
    })
  })

  if (port > 0) httpServer.listen(port)
  return httpServer
}

if (require.main === module) {
  createSocketServer(Number(process.env.SOCKET_PORT) || 4000)
  console.log(`Socket.io server listening on port ${process.env.SOCKET_PORT || 4000}`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- socket-server` — expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add server/socket-server.ts server/socket-server.test.ts package.json
git commit -m "feat: standalone Socket.io server with room-scoped broadcast"
```

---

### Task 8: Client Socket Hook

**Files:**
- Create: `src/hooks/use-auction-socket.ts`
- Test: `src/hooks/use-auction-socket.test.ts`

**Interfaces:**
- Consumes: `useAuctionStore` (Task 6) actions `applyBid`, `markSold`, `markUnsold`; socket event contract from Task 7 (`room:join`, `auction:event`).
- Produces: `useAuctionSocket(roomId: string): void` — a hook that, on mount, connects to the socket server (URL from `NEXT_PUBLIC_SOCKET_URL`), joins `roomId`, and dispatches incoming `auction:event` payloads of shape `{ type: 'BID' | 'SOLD' | 'UNSOLD'; teamId?: string; amount?: number }` to the matching store action. Later interface plans (admin/team/display) call this hook once per page.

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/use-auction-socket.test.ts
import { renderHook } from '@testing-library/react'
import { vi } from 'vitest'

const mockOn = vi.fn()
const mockEmit = vi.fn()
const mockSocket = { on: mockOn, emit: mockEmit, close: vi.fn() }

vi.mock('socket.io-client', () => ({ io: () => mockSocket }))

const applyBid = vi.fn()
const markSold = vi.fn()
const markUnsold = vi.fn()

vi.mock('@/stores/auction-store', () => ({
  useAuctionStore: { getState: () => ({ applyBid, markSold, markUnsold }) },
}))

import { useAuctionSocket } from './use-auction-socket'

describe('useAuctionSocket', () => {
  beforeEach(() => {
    mockOn.mockClear()
    mockEmit.mockClear()
    applyBid.mockClear()
  })

  it('joins the given room on mount', () => {
    renderHook(() => useAuctionSocket('room-1'))
    expect(mockEmit).toHaveBeenCalledWith('room:join', 'room-1')
  })

  it('dispatches a BID event to applyBid', () => {
    renderHook(() => useAuctionSocket('room-1'))
    const handler = mockOn.mock.calls.find(([event]) => event === 'auction:event')![1]
    handler({ type: 'BID', teamId: 'team-1', amount: 200 })
    expect(applyBid).toHaveBeenCalledWith({ teamId: 'team-1', amount: 200 })
  })

  it('dispatches a SOLD event to markSold', () => {
    renderHook(() => useAuctionSocket('room-1'))
    const handler = mockOn.mock.calls.find(([event]) => event === 'auction:event')![1]
    handler({ type: 'SOLD' })
    expect(markSold).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- use-auction-socket` — expected: FAIL, "Cannot find module './use-auction-socket'".

- [ ] **Step 3: Implement the hook**

```typescript
// src/hooks/use-auction-socket.ts
import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { useAuctionStore } from '@/stores/auction-store'

type AuctionEvent =
  | { type: 'BID'; teamId: string; amount: number }
  | { type: 'SOLD' }
  | { type: 'UNSOLD' }

export function useAuctionSocket(roomId: string) {
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000')
    socket.emit('room:join', roomId)

    socket.on('auction:event', (event: AuctionEvent) => {
      const { applyBid, markSold, markUnsold } = useAuctionStore.getState()
      if (event.type === 'BID') applyBid({ teamId: event.teamId, amount: event.amount })
      if (event.type === 'SOLD') markSold()
      if (event.type === 'UNSOLD') markUnsold()
    })

    return () => {
      socket.close()
    }
  }, [roomId])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- use-auction-socket` — expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-auction-socket.ts src/hooks/use-auction-socket.test.ts
git commit -m "feat: client socket hook wiring realtime events into the auction store"
```

---

## Self-Review Notes

- **Spec coverage:** Brand palette (Task 2), typography (Task 2), brutalist card primitive (Task 3), Postgres data model (Task 4), demo seed dataset (Task 5), client state (Task 6), standalone Socket.io realtime (Task 7), client wiring (Task 8). Admin/Team/Display page UIs, animations (GSAP/Framer Motion), auth, and bid-validation business rules are explicitly deferred to the follow-up interface plans, not this foundation.
- **Type consistency:** `RoomState`/`LotState`/`TeamState` (Task 6) are the exact shapes Task 8's hook reads and writes; the socket payload `{ type, teamId?, amount? }` (Task 8) matches the `auction:event` passthrough contract from Task 7.
- **No placeholders:** every step has runnable code and an explicit pass/fail expectation.
