# Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/admin/[roomId]` — the operator's control console: load/advance lots, accept manual bids, run the timer, mark sold/unsold, undo, and drive the whole room's phase — with every mutation persisted to Postgres and broadcast in realtime to the Team/Display interfaces built in later plans.

**Architecture:** Next.js Server Actions do all writes (Prisma mutation → broadcast via a server-side Socket.io-client singleton), so the mutate-then-broadcast step lives in one place, callable from any future interface (Team console will reuse the bid-placing action). The admin page hydrates the existing foundation `useAuctionStore` (phase/currentLot/teams — the live-synced slice) from an initial server fetch and keeps it live via the existing `useAuctionSocket` hook; a second, admin-only local state slice holds richer, less-frequently-changing data (player details, queue, per-team squad/overseas counts) that the page re-fetches after lot-changing actions.

**Tech Stack:** Next.js Server Actions, Prisma, the foundation's Socket.io server/client, Zustand (`useAuctionStore`), `BrutalCard`, Vitest + @testing-library/react.

**Spec:** `C:\Users\aishw\Downloads\auction-website-prd.md` (sections 3-5 for data model/stack, 6.1 for this interface, 8-10 for shared components/animation/non-functional rules)
**Prior plan (already merged):** `docs/superpowers/plans/2026-09-08-auction-live-foundation.md`

## Global Constraints

- SOLD requires a current bidding team selected; disabled otherwise (prevents mis-clicks).
- Undo is log-based: pop the last bid-log entry and recompute state — never a raw overwrite (mirrors `useAuctionStore.undoLastBid`'s pattern, now on the DB side too).
- Every state transition (bid placed, lot sold/unsold, timer event) persists to Postgres as it happens — survives a server restart mid-auction.
- Keyboard shortcuts: Space = start/pause timer, S = mark sold, U = mark unsold, Z = undo.
- Color discipline: Blue = primary/structural, Yellow = attention/value (phase-live pill, base-price tags), Pink = urgency (not much on admin — reserved for countdown-under-10s elsewhere); never combine all three at full saturation in one small area.
- Cards: 2-3px solid charcoal borders, hard-offset shadows, no blur (use `BrutalCard` from the foundation, don't reinvent it).
- Realtime latency target: <300ms bid-to-display update — broadcast immediately after the Prisma write, no batching/debouncing.

---

## File Structure

```
src/
  lib/
    socket-emitter.ts                # server-side Socket.io-client singleton, emitAuctionEvent()
    socket-emitter.test.ts
  app/
    admin/
      [roomId]/
        actions.ts                   # 'use server' — all admin mutations + the read
        actions.test.ts
        page.tsx                     # server component: initial fetch, renders AdminConsole
        admin-console.tsx            # 'use client' — page shell, header, keyboard shortcuts, wires panels
        admin-console.test.tsx
  components/
    admin/
      player-queue.tsx
      player-queue.test.tsx
      live-lot-control.tsx
      live-lot-control.test.tsx
      team-purse-table.tsx
      bid-log.tsx
      team-purse-table.test.tsx
```

---

### Task 1: Server-Side Socket Emitter

**Files:**
- Create: `src/lib/socket-emitter.ts`
- Test: `src/lib/socket-emitter.test.ts`

**Interfaces:**
- Consumes: the foundation's `server/socket-server.ts` event contract (`room:join`, `auction:event`).
- Produces: `emitAuctionEvent(roomId: string, payload: unknown): Promise<void>` — connects once (singleton, like `src/lib/prisma.ts`), joins no room itself (it only needs to emit into one), and broadcasts `payload` to every client in `roomId`. All later admin actions (Tasks 3-5) import this.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/socket-emitter.test.ts
import { io as ioClient, Socket } from 'socket.io-client'
import { createSocketServer } from '../../server/socket-server'
import type { Server as HttpServer } from 'http'
import { emitAuctionEvent, __setSocketPortForTests } from './socket-emitter'

describe('socket-emitter', () => {
  let server: HttpServer
  let port: number
  let listener: Socket

  beforeAll(async () => {
    server = createSocketServer(0)
    await new Promise<void>((resolve) => server.listen(() => resolve()))
    port = (server.address() as any).port
    __setSocketPortForTests(port)
  })

  afterAll(() => {
    listener?.close()
    server.close()
  })

  it('broadcasts a payload to clients in the target room', async () => {
    listener = ioClient(`http://localhost:${port}`)
    await new Promise<void>((resolve) => listener.on('connect', () => resolve()))
    listener.emit('room:join', 'room-1')
    await new Promise((resolve) => setTimeout(resolve, 50))

    const received = new Promise((resolve) => listener.on('auction:event', resolve))
    await emitAuctionEvent('room-1', { type: 'BID', teamId: 'team-1', amount: 150 })

    expect(await received).toEqual({ type: 'BID', teamId: 'team-1', amount: 150 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- socket-emitter` — expected: FAIL, "Cannot find module './socket-emitter'".

- [ ] **Step 3: Implement the emitter**

```typescript
// src/lib/socket-emitter.ts
import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null
let testPort: number | null = null

// Test-only escape hatch so the integration test can point this singleton
// at an ephemeral test server instead of the real SOCKET_PORT.
export function __setSocketPortForTests(port: number | null) {
  testPort = port
  socket?.close()
  socket = null
}

function getSocket(): Socket {
  if (socket) return socket
  const url = testPort
    ? `http://localhost:${testPort}`
    : process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000'
  socket = io(url)
  return socket
}

export function emitAuctionEvent(roomId: string, payload: unknown): Promise<void> {
  return new Promise((resolve) => {
    const s = getSocket()
    if (s.connected) {
      s.emit('auction:event', { roomId, payload })
      resolve()
    } else {
      s.once('connect', () => {
        s.emit('auction:event', { roomId, payload })
        resolve()
      })
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- socket-emitter` — expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/socket-emitter.ts src/lib/socket-emitter.test.ts
git commit -m "feat: server-side Socket.io-client singleton for broadcasting from Server Actions"
```

---

### Task 2: Server Action — Read Room State

**Files:**
- Create: `src/app/admin/[roomId]/actions.ts`
- Test: `src/app/admin/[roomId]/actions.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`.
- Produces: `getAdminSnapshot(roomId: string): Promise<AdminSnapshot>` where:
  ```typescript
  export type AdminSnapshot = {
    room: { id: string; phase: string; round: number }
    currentLot: {
      id: string
      status: string
      currentBid: number
      currentBiddingTeamId: string | null
      timerSeconds: number
      bidHistory: { teamId: string; teamName: string; amount: number; timestamp: string }[]
      player: {
        id: string; name: string; role: string; basePrice: number
        photoUrl: string | null; nationality: string; matches: number
        runs: number | null; wickets: number | null; average: number | null
        strikeRate: number | null; economy: number | null
      }
    } | null
    teams: {
      id: string; name: string; shortCode: string; colorAccent: string
      purseRemaining: number; squadCount: number; squadMax: number
      overseasSlotsUsed: number; overseasSlotsMax: number
    }[]
    queue: { id: string; name: string; role: string; basePrice: number; setNumber: string; status: string }[]
  }
  ```
  Task 6 (page.tsx) calls this for the initial page load; Task 3-5's mutation actions return the same shape after mutating so the client can update without a second round trip.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/admin/[roomId]/actions.test.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getAdminSnapshot } from './actions'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

describe('getAdminSnapshot', () => {
  let roomId: string
  let teamId: string
  let playerId: string
  let lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Test Room', phase: 'LIVE' } })
    roomId = room.id
    const team = await prisma.team.create({
      data: { roomId, name: 'Test Team', shortCode: 'TST', purseTotal: 10000, purseRemaining: 9000, squadMax: 25, squadMin: 18, overseasSlotsMax: 8 },
    })
    teamId = team.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Test Player', role: 'BATTER', basePrice: 20, nationality: 'India', matches: 50, setNumber: 'Set 1', status: 'LIVE' },
    })
    playerId = player.id
    await prisma.player.create({
      data: { roomId, name: 'Queued Player', role: 'BOWLER', basePrice: 30, nationality: 'India', matches: 20, setNumber: 'Set 1', status: 'UPCOMING' },
    })
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId, currentBid: 20, status: 'BIDDING', timerSeconds: 30, currentBiddingTeamId: teamId },
    })
    lotId = lot.id
    await prisma.bid.create({ data: { lotId, teamId, amount: 20 } })
  })

  afterAll(async () => {
    await prisma.bid.deleteMany({ where: { lotId } })
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.team.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
    await prisma.$disconnect()
  })

  it('returns room phase and the current lot with player details and bid history', async () => {
    const snapshot = await getAdminSnapshot(roomId)
    expect(snapshot.room.phase).toBe('LIVE')
    expect(snapshot.currentLot?.player.name).toBe('Test Player')
    expect(snapshot.currentLot?.currentBid).toBe(20)
    expect(snapshot.currentLot?.bidHistory).toHaveLength(1)
    expect(snapshot.currentLot?.bidHistory[0]).toMatchObject({ teamId, teamName: 'Test Team', amount: 20 })
  })

  it('returns teams with squad/purse counts', async () => {
    const snapshot = await getAdminSnapshot(roomId)
    expect(snapshot.teams).toHaveLength(1)
    expect(snapshot.teams[0]).toMatchObject({ name: 'Test Team', purseRemaining: 9000, squadCount: 0 })
  })

  it('returns the upcoming-player queue excluding the current lot player', async () => {
    const snapshot = await getAdminSnapshot(roomId)
    expect(snapshot.queue).toHaveLength(1)
    expect(snapshot.queue[0].name).toBe('Queued Player')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- actions` — expected: FAIL, "Cannot find module './actions'".

- [ ] **Step 3: Implement `getAdminSnapshot`**

```typescript
// src/app/admin/[roomId]/actions.ts
'use server'

import { prisma } from '@/lib/prisma'

export type AdminSnapshot = {
  room: { id: string; phase: string; round: number }
  currentLot: {
    id: string
    status: string
    currentBid: number
    currentBiddingTeamId: string | null
    timerSeconds: number
    bidHistory: { teamId: string; teamName: string; amount: number; timestamp: string }[]
    player: {
      id: string; name: string; role: string; basePrice: number
      photoUrl: string | null; nationality: string; matches: number
      runs: number | null; wickets: number | null; average: number | null
      strikeRate: number | null; economy: number | null
    }
  } | null
  teams: {
    id: string; name: string; shortCode: string; colorAccent: string
    purseRemaining: number; squadCount: number; squadMax: number
    overseasSlotsUsed: number; overseasSlotsMax: number
  }[]
  queue: { id: string; name: string; role: string; basePrice: number; setNumber: string; status: string }[]
}

export async function getAdminSnapshot(roomId: string): Promise<AdminSnapshot> {
  const room = await prisma.auctionRoom.findUniqueOrThrow({ where: { id: roomId } })

  const lot = await prisma.auctionLot.findFirst({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
    include: { player: true, bids: { include: { team: true }, orderBy: { timestamp: 'asc' } } },
    orderBy: { id: 'desc' },
  })

  const teamsRaw = await prisma.team.findMany({
    where: { roomId },
    include: { players: true },
  })

  const queueRaw = await prisma.player.findMany({
    where: { roomId, status: 'UPCOMING' },
    orderBy: { id: 'asc' },
  })

  return {
    room: { id: room.id, phase: room.phase, round: room.round },
    currentLot: lot
      ? {
          id: lot.id,
          status: lot.status,
          currentBid: lot.currentBid,
          currentBiddingTeamId: lot.currentBiddingTeamId,
          timerSeconds: lot.timerSeconds,
          bidHistory: lot.bids.map((b) => ({
            teamId: b.teamId,
            teamName: b.team.name,
            amount: b.amount,
            timestamp: b.timestamp.toISOString(),
          })),
          player: {
            id: lot.player.id,
            name: lot.player.name,
            role: lot.player.role,
            basePrice: lot.player.basePrice,
            photoUrl: lot.player.photoUrl,
            nationality: lot.player.nationality,
            matches: lot.player.matches,
            runs: lot.player.runs,
            wickets: lot.player.wickets,
            average: lot.player.average,
            strikeRate: lot.player.strikeRate,
            economy: lot.player.economy,
          },
        }
      : null,
    teams: teamsRaw.map((t) => ({
      id: t.id,
      name: t.name,
      shortCode: t.shortCode,
      colorAccent: t.colorAccent,
      purseRemaining: t.purseRemaining,
      squadCount: t.players.length,
      squadMax: t.squadMax,
      overseasSlotsUsed: t.overseasSlotsUsed,
      overseasSlotsMax: t.overseasSlotsMax,
    })),
    queue: queueRaw.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      basePrice: p.basePrice,
      setNumber: p.setNumber,
      status: p.status,
    })),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- actions` — expected: PASS, 3 tests (requires `docker compose up -d db` running, migrated).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\[roomId\]/actions.ts src/app/admin/\[roomId\]/actions.test.ts
git commit -m "feat: getAdminSnapshot server action reading full room/lot/team/queue state"
```

---

### Task 3: Server Action — Bid Mutation

**Files:**
- Modify: `src/app/admin/[roomId]/actions.ts`
- Modify: `src/app/admin/[roomId]/actions.test.ts`

**Interfaces:**
- Consumes: `emitAuctionEvent` (Task 1), `getAdminSnapshot` (Task 2).
- Produces: `placeBid(roomId: string, teamId: string, amount: number): Promise<AdminSnapshot>` — creates a `Bid` row, updates the current `AuctionLot`'s `currentBid`/`currentBiddingTeamId`, broadcasts `{type:'BID', teamId, amount}`, returns the fresh snapshot.

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/app/admin/[roomId]/actions.test.ts
import { placeBid } from './actions'

describe('placeBid', () => {
  let roomId: string
  let teamId: string
  let lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Bid Room', phase: 'LIVE' } })
    roomId = room.id
    const team = await prisma.team.create({
      data: { roomId, name: 'Bid Team', shortCode: 'BID', purseTotal: 10000, purseRemaining: 10000, squadMax: 25, squadMin: 18, overseasSlotsMax: 8 },
    })
    teamId = team.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Bid Player', role: 'BATTER', basePrice: 20, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId: player.id, currentBid: 20, status: 'BIDDING', timerSeconds: 30 },
    })
    lotId = lot.id
  })

  afterAll(async () => {
    await prisma.bid.deleteMany({ where: { lotId } })
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.team.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('creates a bid, updates the lot, and returns the fresh snapshot', async () => {
    const snapshot = await placeBid(roomId, teamId, 50)
    expect(snapshot.currentLot?.currentBid).toBe(50)
    expect(snapshot.currentLot?.currentBiddingTeamId).toBe(teamId)
    expect(snapshot.currentLot?.bidHistory).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- actions -t placeBid` — expected: FAIL, `placeBid` is not exported.

- [ ] **Step 3: Implement `placeBid`**

```typescript
// add to src/app/admin/[roomId]/actions.ts
import { emitAuctionEvent } from '@/lib/socket-emitter'

export async function placeBid(roomId: string, teamId: string, amount: number): Promise<AdminSnapshot> {
  const lot = await prisma.auctionLot.findFirstOrThrow({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
  })

  await prisma.$transaction([
    prisma.bid.create({ data: { lotId: lot.id, teamId, amount } }),
    prisma.auctionLot.update({
      where: { id: lot.id },
      data: { currentBid: amount, currentBiddingTeamId: teamId, status: 'BIDDING' },
    }),
  ])

  await emitAuctionEvent(roomId, { type: 'BID', teamId, amount })
  return getAdminSnapshot(roomId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- actions` — expected: PASS, all tests (4 so far).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\[roomId\]/actions.ts src/app/admin/\[roomId\]/actions.test.ts
git commit -m "feat: placeBid server action"
```

---

### Task 4: Server Actions — Sold / Unsold / Undo

**Files:**
- Modify: `src/app/admin/[roomId]/actions.ts`
- Modify: `src/app/admin/[roomId]/actions.test.ts`

**Interfaces:**
- Consumes: `emitAuctionEvent`, `getAdminSnapshot`, `prisma`.
- Produces: `markSold(roomId): Promise<AdminSnapshot>`, `markUnsold(roomId): Promise<AdminSnapshot>`, `undoLastBid(roomId): Promise<AdminSnapshot>`.

- [ ] **Step 1: Write the failing tests**

```typescript
// append to src/app/admin/[roomId]/actions.test.ts
import { markSold, markUnsold, undoLastBid } from './actions'

describe('markSold', () => {
  let roomId: string, teamId: string, playerId: string, lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Sold Room', phase: 'LIVE' } })
    roomId = room.id
    const team = await prisma.team.create({
      data: { roomId, name: 'Sold Team', shortCode: 'SLD', purseTotal: 10000, purseRemaining: 10000, squadMax: 25, squadMin: 18, overseasSlotsMax: 8 },
    })
    teamId = team.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Sold Player', role: 'BATTER', basePrice: 20, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    playerId = player.id
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId, currentBid: 80, currentBiddingTeamId: teamId, status: 'BIDDING', timerSeconds: 30 },
    })
    lotId = lot.id
  })

  afterAll(async () => {
    await prisma.bid.deleteMany({ where: { lotId } })
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.team.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('sets the lot sold, assigns the player to the team, and deducts the purse', async () => {
    const snapshot = await markSold(roomId)
    expect(snapshot.currentLot?.status).toBe('SOLD')
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } })
    expect(player.status).toBe('SOLD')
    expect(player.teamId).toBe(teamId)
    expect(player.soldPrice).toBe(80)
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } })
    expect(team.purseRemaining).toBe(9920)
  })
})

describe('markUnsold', () => {
  let roomId: string, playerId: string, lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Unsold Room', phase: 'LIVE' } })
    roomId = room.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Unsold Player', role: 'BOWLER', basePrice: 20, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    playerId = player.id
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId, currentBid: 20, status: 'BIDDING', timerSeconds: 30 },
    })
    lotId = lot.id
  })

  afterAll(async () => {
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('sets the lot and player unsold with no team assigned', async () => {
    const snapshot = await markUnsold(roomId)
    expect(snapshot.currentLot?.status).toBe('UNSOLD')
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } })
    expect(player.status).toBe('UNSOLD')
    expect(player.teamId).toBeNull()
  })
})

describe('undoLastBid', () => {
  let roomId: string, teamId: string, lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Undo Room', phase: 'LIVE' } })
    roomId = room.id
    const team = await prisma.team.create({
      data: { roomId, name: 'Undo Team', shortCode: 'UND', purseTotal: 10000, purseRemaining: 10000, squadMax: 25, squadMin: 18, overseasSlotsMax: 8 },
    })
    teamId = team.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Undo Player', role: 'BATTER', basePrice: 20, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId: player.id, currentBid: 20, status: 'BIDDING', timerSeconds: 30 },
    })
    lotId = lot.id
    await prisma.bid.create({ data: { lotId, teamId, amount: 40 } })
    await prisma.bid.create({ data: { lotId, teamId, amount: 60 } })
    await prisma.auctionLot.update({ where: { id: lotId }, data: { currentBid: 60, currentBiddingTeamId: teamId } })
  })

  afterAll(async () => {
    await prisma.bid.deleteMany({ where: { lotId } })
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.team.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('pops the last bid and recomputes currentBid from the remaining history', async () => {
    const snapshot = await undoLastBid(roomId)
    expect(snapshot.currentLot?.currentBid).toBe(40)
    expect(snapshot.currentLot?.bidHistory).toHaveLength(1)
  })

  it('undo again with one bid left falls back to the lot player\'s base price', async () => {
    const snapshot = await undoLastBid(roomId)
    expect(snapshot.currentLot?.currentBid).toBe(20)
    expect(snapshot.currentLot?.currentBiddingTeamId).toBeNull()
    expect(snapshot.currentLot?.bidHistory).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- actions` — expected: FAIL, `markSold`/`markUnsold`/`undoLastBid` not exported.

- [ ] **Step 3: Implement the three actions**

```typescript
// add to src/app/admin/[roomId]/actions.ts
export async function markSold(roomId: string): Promise<AdminSnapshot> {
  const lot = await prisma.auctionLot.findFirstOrThrow({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
  })
  if (!lot.currentBiddingTeamId) throw new Error('Cannot mark sold with no bidding team')

  await prisma.$transaction([
    prisma.auctionLot.update({ where: { id: lot.id }, data: { status: 'SOLD' } }),
    prisma.player.update({
      where: { id: lot.playerId },
      data: { status: 'SOLD', teamId: lot.currentBiddingTeamId, soldPrice: lot.currentBid },
    }),
    prisma.team.update({
      where: { id: lot.currentBiddingTeamId },
      data: { purseRemaining: { decrement: lot.currentBid } },
    }),
  ])

  await emitAuctionEvent(roomId, { type: 'SOLD' })
  return getAdminSnapshot(roomId)
}

export async function markUnsold(roomId: string): Promise<AdminSnapshot> {
  const lot = await prisma.auctionLot.findFirstOrThrow({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
  })

  await prisma.$transaction([
    prisma.auctionLot.update({ where: { id: lot.id }, data: { status: 'UNSOLD' } }),
    prisma.player.update({ where: { id: lot.playerId }, data: { status: 'UNSOLD' } }),
  ])

  await emitAuctionEvent(roomId, { type: 'UNSOLD' })
  return getAdminSnapshot(roomId)
}

export async function undoLastBid(roomId: string): Promise<AdminSnapshot> {
  const lot = await prisma.auctionLot.findFirstOrThrow({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
    include: { player: true },
  })

  const lastBid = await prisma.bid.findFirst({ where: { lotId: lot.id }, orderBy: { timestamp: 'desc' } })
  if (!lastBid) return getAdminSnapshot(roomId)

  const remaining = await prisma.bid.findMany({
    where: { lotId: lot.id, id: { not: lastBid.id } },
    orderBy: { timestamp: 'desc' },
  })
  const newHead = remaining[0]

  await prisma.$transaction([
    prisma.bid.delete({ where: { id: lastBid.id } }),
    prisma.auctionLot.update({
      where: { id: lot.id },
      data: {
        currentBid: newHead ? newHead.amount : lot.player.basePrice,
        currentBiddingTeamId: newHead ? newHead.teamId : null,
      },
    }),
  ])

  await emitAuctionEvent(roomId, { type: 'UNDO' })
  return getAdminSnapshot(roomId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- actions` — expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\[roomId\]/actions.ts src/app/admin/\[roomId\]/actions.test.ts
git commit -m "feat: markSold/markUnsold/undoLastBid server actions, log-based undo"
```

---

### Task 5: Server Actions — Timer / Phase / Lot Advance

**Files:**
- Modify: `src/app/admin/[roomId]/actions.ts`
- Modify: `src/app/admin/[roomId]/actions.test.ts`

**Interfaces:**
- Produces: `controlTimer(roomId, action: 'start' | 'pause' | 'reset' | 'add10'): Promise<AdminSnapshot>`, `setPhase(roomId, phase: 'LIVE' | 'PAUSED' | 'COMPLETED'): Promise<AdminSnapshot>`, `advanceToNextLot(roomId): Promise<AdminSnapshot>` (pulls the next `UPCOMING` player, marks it `LIVE`, creates its `AuctionLot` at `QUEUED` with `currentBid = basePrice`).

- [ ] **Step 1: Write the failing tests**

```typescript
// append to src/app/admin/[roomId]/actions.test.ts
import { controlTimer, setPhase, advanceToNextLot } from './actions'

describe('controlTimer', () => {
  let roomId: string, lotId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Timer Room', phase: 'LIVE' } })
    roomId = room.id
    const player = await prisma.player.create({
      data: { roomId, name: 'Timer Player', role: 'BATTER', basePrice: 20, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'LIVE' },
    })
    const lot = await prisma.auctionLot.create({
      data: { roomId, playerId: player.id, currentBid: 20, status: 'BIDDING', timerSeconds: 30 },
    })
    lotId = lot.id
  })

  afterAll(async () => {
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('add10 increments timerSeconds by 10', async () => {
    const snapshot = await controlTimer(roomId, 'add10')
    expect(snapshot.currentLot?.timerSeconds).toBe(40)
  })

  it('reset sets timerSeconds back to 30', async () => {
    const snapshot = await controlTimer(roomId, 'reset')
    expect(snapshot.currentLot?.timerSeconds).toBe(30)
  })
})

describe('setPhase', () => {
  it('updates room phase', async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Phase Room', phase: 'LIVE' } })
    const snapshot = await setPhase(room.id, 'PAUSED')
    expect(snapshot.room.phase).toBe('PAUSED')
    await prisma.auctionRoom.delete({ where: { id: room.id } })
  })
})

describe('advanceToNextLot', () => {
  let roomId: string

  beforeAll(async () => {
    const room = await prisma.auctionRoom.create({ data: { name: 'Advance Room', phase: 'LIVE' } })
    roomId = room.id
    await prisma.player.create({
      data: { roomId, name: 'Next Player', role: 'BATTER', basePrice: 30, nationality: 'India', matches: 10, setNumber: 'Set 1', status: 'UPCOMING' },
    })
  })

  afterAll(async () => {
    await prisma.auctionLot.deleteMany({ where: { roomId } })
    await prisma.player.deleteMany({ where: { roomId } })
    await prisma.auctionRoom.delete({ where: { id: roomId } })
  })

  it('loads the next upcoming player as the current lot at its base price', async () => {
    const snapshot = await advanceToNextLot(roomId)
    expect(snapshot.currentLot?.player.name).toBe('Next Player')
    expect(snapshot.currentLot?.currentBid).toBe(30)
    expect(snapshot.currentLot?.status).toBe('QUEUED')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- actions` — expected: FAIL, functions not exported.

- [ ] **Step 3: Implement the three actions**

```typescript
// add to src/app/admin/[roomId]/actions.ts
const TIMER_DEFAULT_SECONDS = 30

export async function controlTimer(
  roomId: string,
  action: 'start' | 'pause' | 'reset' | 'add10'
): Promise<AdminSnapshot> {
  const lot = await prisma.auctionLot.findFirstOrThrow({
    where: { roomId, status: { in: ['QUEUED', 'BIDDING'] } },
  })

  const timerSeconds =
    action === 'reset' ? TIMER_DEFAULT_SECONDS : action === 'add10' ? lot.timerSeconds + 10 : lot.timerSeconds

  await prisma.auctionLot.update({ where: { id: lot.id }, data: { timerSeconds } })
  await emitAuctionEvent(roomId, { type: 'TIMER', action, timerSeconds })
  return getAdminSnapshot(roomId)
}

export async function setPhase(
  roomId: string,
  phase: 'LIVE' | 'PAUSED' | 'COMPLETED'
): Promise<AdminSnapshot> {
  await prisma.auctionRoom.update({ where: { id: roomId }, data: { phase } })
  await emitAuctionEvent(roomId, { type: 'PHASE', phase })
  return getAdminSnapshot(roomId)
}

export async function advanceToNextLot(roomId: string): Promise<AdminSnapshot> {
  const next = await prisma.player.findFirst({ where: { roomId, status: 'UPCOMING' }, orderBy: { id: 'asc' } })
  if (!next) return getAdminSnapshot(roomId)

  await prisma.$transaction([
    prisma.player.update({ where: { id: next.id }, data: { status: 'LIVE' } }),
    prisma.auctionLot.create({
      data: {
        roomId,
        playerId: next.id,
        currentBid: next.basePrice,
        status: 'QUEUED',
        timerSeconds: TIMER_DEFAULT_SECONDS,
      },
    }),
  ])

  await emitAuctionEvent(roomId, { type: 'LOT_CHANGE', playerId: next.id })
  return getAdminSnapshot(roomId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- actions` — expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\[roomId\]/actions.ts src/app/admin/\[roomId\]/actions.test.ts
git commit -m "feat: controlTimer/setPhase/advanceToNextLot server actions"
```

---

### Task 6: Admin Page Shell & Header

**Files:**
- Create: `src/app/admin/[roomId]/page.tsx`
- Create: `src/app/admin/[roomId]/admin-console.tsx`
- Test: `src/app/admin/[roomId]/admin-console.test.tsx`

**Interfaces:**
- Consumes: `getAdminSnapshot`, `setPhase` (Tasks 2, 5); `useAuctionStore.setRoom` (foundation Task 6); `useAuctionSocket` (foundation Task 8); `BrutalCard` (foundation Task 3).
- Produces: the `AdminConsole` client component, which Tasks 7-9's panels mount inside — `AdminConsole` owns the `AdminSnapshot` state and passes it + action callbacks down as props. Later tasks import nothing new from this file; they receive props.

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/admin/[roomId]/admin-console.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { AdminConsole } from './admin-console'
import type { AdminSnapshot } from './actions'

vi.mock('@/hooks/use-auction-socket', () => ({ useAuctionSocket: vi.fn() }))
vi.mock('@/stores/auction-store', () => ({
  useAuctionStore: Object.assign(
    vi.fn(() => ({ room: null })),
    { getState: () => ({ setRoom: vi.fn() }) }
  ),
}))

const baseSnapshot: AdminSnapshot = {
  room: { id: 'room-1', phase: 'LIVE', round: 1 },
  currentLot: null,
  teams: [],
  queue: [],
}

describe('AdminConsole', () => {
  it('renders the phase pill showing the current phase', () => {
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('shows a confirm modal before ending the auction, and does not end it on cancel', () => {
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: /end auction/i }))
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- admin-console` — expected: FAIL, "Cannot find module './admin-console'".

- [ ] **Step 3: Implement the page and console shell**

```tsx
// src/app/admin/[roomId]/page.tsx
import { getAdminSnapshot } from './actions'
import { AdminConsole } from './admin-console'

export default async function AdminPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const initialSnapshot = await getAdminSnapshot(roomId)
  return <AdminConsole roomId={roomId} initialSnapshot={initialSnapshot} />
}
```

```tsx
// src/app/admin/[roomId]/admin-console.tsx
'use client'

import { useEffect, useState } from 'react'
import { BrutalCard } from '@/components/ui/brutal-card'
import { useAuctionSocket } from '@/hooks/use-auction-socket'
import { useAuctionStore } from '@/stores/auction-store'
import { setPhase, type AdminSnapshot } from './actions'
import { PlayerQueue } from '@/components/admin/player-queue'
import { LiveLotControl } from '@/components/admin/live-lot-control'
import { TeamPurseTable } from '@/components/admin/team-purse-table'
import { BidLog } from '@/components/admin/bid-log'

export function AdminConsole({
  roomId,
  initialSnapshot,
}: {
  roomId: string
  initialSnapshot: AdminSnapshot
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  useAuctionSocket(roomId)

  useEffect(() => {
    useAuctionStore.getState().setRoom({
      id: snapshot.room.id,
      phase: snapshot.room.phase,
      currentLot: snapshot.currentLot
        ? {
            id: snapshot.currentLot.id,
            playerId: snapshot.currentLot.player.id,
            currentBid: snapshot.currentLot.currentBid,
            currentBiddingTeamId: snapshot.currentLot.currentBiddingTeamId,
            status: snapshot.currentLot.status,
            bidHistory: snapshot.currentLot.bidHistory,
          }
        : null,
      teams: snapshot.teams.map((t) => ({ id: t.id, name: t.name, purseRemaining: t.purseRemaining })),
    })
  }, [snapshot])

  async function handlePauseResume() {
    const next = snapshot.room.phase === 'LIVE' ? 'PAUSED' : 'LIVE'
    setSnapshot(await setPhase(roomId, next))
  }

  async function handleEndAuction() {
    setSnapshot(await setPhase(roomId, 'COMPLETED'))
    setShowEndConfirm(false)
  }

  return (
    <div className="min-h-screen bg-brand-charcoal p-4 flex flex-col gap-4">
      <BrutalCard className="flex items-center justify-between">
        <span className="font-heading text-xl">Auction Live — Admin</span>
        <span className="bg-brand-yellow border-2 border-brand-charcoal px-3 py-1 font-heading">
          {snapshot.room.phase}
        </span>
        <div className="flex gap-2">
          <button onClick={handlePauseResume} className="border-2 border-brand-charcoal px-3 py-1 bg-brand-blue text-brand-white">
            {snapshot.room.phase === 'LIVE' ? 'Pause' : 'Resume'}
          </button>
          <button onClick={() => setShowEndConfirm(true)} className="border-2 border-brand-charcoal px-3 py-1 bg-brand-charcoal text-brand-white">
            End Auction
          </button>
        </div>
      </BrutalCard>

      {showEndConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
          <BrutalCard>
            <p>Are you sure you want to end the auction?</p>
            <div className="flex gap-2 mt-2">
              <button onClick={handleEndAuction} className="border-2 border-brand-charcoal px-3 py-1 bg-brand-pink">Confirm</button>
              <button onClick={() => setShowEndConfirm(false)} className="border-2 border-brand-charcoal px-3 py-1">Cancel</button>
            </div>
          </BrutalCard>
        </div>
      )}

      <div className="flex gap-4 flex-1">
        <PlayerQueue roomId={roomId} queue={snapshot.queue} onSnapshot={setSnapshot} />
        <LiveLotControl roomId={roomId} snapshot={snapshot} onSnapshot={setSnapshot} />
        <TeamPurseTable teams={snapshot.teams} activeBiddingTeamId={snapshot.currentLot?.currentBiddingTeamId ?? null} />
      </div>
      <BidLog bidHistory={snapshot.currentLot?.bidHistory ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Note: this test imports `PlayerQueue`, `LiveLotControl`, `TeamPurseTable`, `BidLog` which don't exist until Tasks 7-9. Create minimal stub files now so this task's test can pass in isolation; Tasks 7-9 will replace each stub with the real implementation (same file path, so no conflict):

```tsx
// src/components/admin/player-queue.tsx (stub — replaced by Task 7)
export function PlayerQueue(_props: any) { return null }
```
```tsx
// src/components/admin/live-lot-control.tsx (stub — replaced by Task 8)
export function LiveLotControl(_props: any) { return null }
```
```tsx
// src/components/admin/team-purse-table.tsx (stub — replaced by Task 9)
export function TeamPurseTable(_props: any) { return null }
```
```tsx
// src/components/admin/bid-log.tsx (stub — replaced by Task 9)
export function BidLog(_props: any) { return null }
```

Run: `npm test -- admin-console` — expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\[roomId\]/page.tsx src/app/admin/\[roomId\]/admin-console.tsx src/app/admin/\[roomId\]/admin-console.test.tsx src/components/admin/
git commit -m "feat: admin page shell, header, pause/resume/end-auction with confirm modal"
```

---

### Task 7: Player Queue Panel

**Files:**
- Modify: `src/components/admin/player-queue.tsx` (replace stub)
- Test: `src/components/admin/player-queue.test.tsx`

**Interfaces:**
- Consumes: `advanceToNextLot` (Task 5), `BrutalCard`.
- Produces: `PlayerQueue({ roomId, queue, onSnapshot })` — `queue: AdminSnapshot['queue']`, `onSnapshot: (s: AdminSnapshot) => void`. Renders a searchable/filterable list; clicking a row (or a "Load Next" button when nothing is selected) calls `advanceToNextLot` and reports the new snapshot upward.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/player-queue.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { PlayerQueue } from './player-queue'
import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'

vi.mock('@/app/admin/[roomId]/actions', () => ({
  advanceToNextLot: vi.fn(async () => ({ room: { id: 'r1', phase: 'LIVE', round: 1 }, currentLot: null, teams: [], queue: [] }) as AdminSnapshot),
}))

const queue: AdminSnapshot['queue'] = [
  { id: 'p1', name: 'Alice Batter', role: 'BATTER', basePrice: 20, setNumber: 'Marquee Set', status: 'UPCOMING' },
  { id: 'p2', name: 'Bob Bowler', role: 'BOWLER', basePrice: 30, setNumber: 'Set 2', status: 'UPCOMING' },
]

describe('PlayerQueue', () => {
  it('renders every queued player', () => {
    render(<PlayerQueue roomId="r1" queue={queue} onSnapshot={vi.fn()} />)
    expect(screen.getByText('Alice Batter')).toBeInTheDocument()
    expect(screen.getByText('Bob Bowler')).toBeInTheDocument()
  })

  it('filters by search text', () => {
    render(<PlayerQueue roomId="r1" queue={queue} onSnapshot={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Alice' } })
    expect(screen.getByText('Alice Batter')).toBeInTheDocument()
    expect(screen.queryByText('Bob Bowler')).not.toBeInTheDocument()
  })

  it('filters by role', () => {
    render(<PlayerQueue roomId="r1" queue={queue} onSnapshot={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'BOWLER' } })
    expect(screen.queryByText('Alice Batter')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Bowler')).toBeInTheDocument()
  })

  it('calls advanceToNextLot and reports the new snapshot when Load Next is clicked', async () => {
    const { advanceToNextLot } = await import('@/app/admin/[roomId]/actions')
    const onSnapshot = vi.fn()
    render(<PlayerQueue roomId="r1" queue={queue} onSnapshot={onSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: /load next/i }))
    await vi.waitFor(() => expect(advanceToNextLot).toHaveBeenCalledWith('r1'))
    await vi.waitFor(() => expect(onSnapshot).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- player-queue` — expected: FAIL (stub renders nothing, none of the assertions find text).

- [ ] **Step 3: Implement `PlayerQueue`**

```tsx
// src/components/admin/player-queue.tsx
'use client'

import { useState } from 'react'
import { BrutalCard } from '@/components/ui/brutal-card'
import { advanceToNextLot, type AdminSnapshot } from '@/app/admin/[roomId]/actions'

export function PlayerQueue({
  roomId,
  queue,
  onSnapshot,
}: {
  roomId: string
  queue: AdminSnapshot['queue']
  onSnapshot: (s: AdminSnapshot) => void
}) {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')

  const filtered = queue.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (role === '' || p.role === role)
  )

  async function handleLoadNext() {
    onSnapshot(await advanceToNextLot(roomId))
  }

  return (
    <BrutalCard className="w-64 flex flex-col gap-2">
      <h2 className="font-heading">Player Queue</h2>
      <input
        placeholder="Search players"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border-2 border-brand-charcoal px-2 py-1"
      />
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value)} className="border-2 border-brand-charcoal ml-2">
          <option value="">All</option>
          <option value="BATTER">Batter</option>
          <option value="BOWLER">Bowler</option>
          <option value="ALL_ROUNDER">All-Rounder</option>
          <option value="WICKET_KEEPER">Wicket-Keeper</option>
        </select>
      </label>
      <button onClick={handleLoadNext} className="border-2 border-brand-charcoal px-3 py-1 bg-brand-blue text-brand-white">
        Load Next
      </button>
      <ul className="flex flex-col gap-1 overflow-y-auto">
        {filtered.map((p) => (
          <li key={p.id} className="border-2 border-brand-charcoal px-2 py-1">
            {p.name} — {p.setNumber}
          </li>
        ))}
      </ul>
    </BrutalCard>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- player-queue` — expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/player-queue.tsx src/components/admin/player-queue.test.tsx
git commit -m "feat: PlayerQueue panel — search/filter, load-next"
```

---

### Task 8: Live Lot Control Panel

**Files:**
- Modify: `src/components/admin/live-lot-control.tsx` (replace stub)
- Test: `src/components/admin/live-lot-control.test.tsx`

**Interfaces:**
- Consumes: `placeBid`, `markSold`, `markUnsold`, `undoLastBid`, `controlTimer` (Tasks 3-5), `BrutalCard`.
- Produces: `LiveLotControl({ roomId, snapshot, onSnapshot })`. Exposes imperative handlers `window.__adminLotControl = { markSold, markUnsold, undoLastBid, toggleTimer }` is NOT used — instead, Task 10's keyboard-shortcut layer calls the same server actions directly (it does not reach into this component), so this component only needs its own button-driven UI; no ref/handle API is required.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/live-lot-control.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { LiveLotControl } from './live-lot-control'
import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'

vi.mock('@/app/admin/[roomId]/actions', () => ({
  placeBid: vi.fn(async () => ({} as AdminSnapshot)),
  markSold: vi.fn(async () => ({} as AdminSnapshot)),
  markUnsold: vi.fn(async () => ({} as AdminSnapshot)),
  undoLastBid: vi.fn(async () => ({} as AdminSnapshot)),
  controlTimer: vi.fn(async () => ({} as AdminSnapshot)),
}))

const snapshotWithTeam: AdminSnapshot = {
  room: { id: 'r1', phase: 'LIVE', round: 1 },
  currentLot: {
    id: 'lot-1', status: 'BIDDING', currentBid: 50, currentBiddingTeamId: 'team-1', timerSeconds: 30,
    bidHistory: [],
    player: { id: 'p1', name: 'Test Player', role: 'BATTER', basePrice: 20, photoUrl: null, nationality: 'India', matches: 10, runs: null, wickets: null, average: null, strikeRate: null, economy: null },
  },
  teams: [{ id: 'team-1', name: 'Team A', shortCode: 'TMA', colorAccent: '#2074D5', purseRemaining: 9950, squadCount: 0, squadMax: 25, overseasSlotsUsed: 0, overseasSlotsMax: 8 }],
  queue: [],
}

const snapshotNoTeam: AdminSnapshot = { ...snapshotWithTeam, currentLot: { ...snapshotWithTeam.currentLot!, currentBiddingTeamId: null } }

describe('LiveLotControl', () => {
  it('shows the current player name and bid', () => {
    render(<LiveLotControl roomId="r1" snapshot={snapshotWithTeam} onSnapshot={vi.fn()} />)
    expect(screen.getByText('Test Player')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('disables the SOLD button when no bidding team is set', () => {
    render(<LiveLotControl roomId="r1" snapshot={snapshotNoTeam} onSnapshot={vi.fn()} />)
    expect(screen.getByRole('button', { name: /sold/i })).toBeDisabled()
  })

  it('enables the SOLD button when a bidding team is set', () => {
    render(<LiveLotControl roomId="r1" snapshot={snapshotWithTeam} onSnapshot={vi.fn()} />)
    expect(screen.getByRole('button', { name: /sold/i })).not.toBeDisabled()
  })

  it('calls placeBid with the base price plus the quick-increment amount for the first eligible team', async () => {
    const { placeBid } = await import('@/app/admin/[roomId]/actions')
    render(<LiveLotControl roomId="r1" snapshot={snapshotWithTeam} onSnapshot={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '+5L' }))
    await vi.waitFor(() => expect(placeBid).toHaveBeenCalledWith('r1', 'team-1', 55))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- live-lot-control` — expected: FAIL (stub renders nothing).

- [ ] **Step 3: Implement `LiveLotControl`**

```tsx
// src/components/admin/live-lot-control.tsx
'use client'

import { BrutalCard } from '@/components/ui/brutal-card'
import { placeBid, markSold, markUnsold, undoLastBid, controlTimer, type AdminSnapshot } from '@/app/admin/[roomId]/actions'

const INCREMENTS = [5, 10, 25, 50]

export function LiveLotControl({
  roomId,
  snapshot,
  onSnapshot,
}: {
  roomId: string
  snapshot: AdminSnapshot
  onSnapshot: (s: AdminSnapshot) => void
}) {
  const lot = snapshot.currentLot
  if (!lot) return <BrutalCard className="flex-1">No active lot — load a player from the queue.</BrutalCard>

  // Quick-increment bids are attributed to the first team that isn't already
  // the current bidder — a real room calls out the bidding team verbally;
  // this keeps the demo/test path simple without a team-picker UI.
  const nextBidder = snapshot.teams.find((t) => t.id !== lot.currentBiddingTeamId) ?? snapshot.teams[0]

  async function handleIncrement(amount: number) {
    if (!nextBidder) return
    onSnapshot(await placeBid(roomId, nextBidder.id, lot!.currentBid + amount))
  }

  async function handleSold() {
    onSnapshot(await markSold(roomId))
  }
  async function handleUnsold() {
    onSnapshot(await markUnsold(roomId))
  }
  async function handleUndo() {
    onSnapshot(await undoLastBid(roomId))
  }
  async function handleTimer(action: 'start' | 'pause' | 'reset' | 'add10') {
    onSnapshot(await controlTimer(roomId, action))
  }

  return (
    <BrutalCard className="flex-1 flex flex-col gap-2">
      <h2 className="font-heading">{lot.player.name}</h2>
      <p>{lot.player.role} — Base {lot.player.basePrice}</p>
      <p className="font-heading text-3xl tabular-nums">{lot.currentBid}</p>

      <div className="flex gap-2">
        {INCREMENTS.map((inc) => (
          <button key={inc} onClick={() => handleIncrement(inc)} className="border-2 border-brand-charcoal px-2 py-1 bg-brand-yellow">
            +{inc}L
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => handleTimer('start')} className="border-2 border-brand-charcoal px-2 py-1">Start</button>
        <button onClick={() => handleTimer('pause')} className="border-2 border-brand-charcoal px-2 py-1">Pause</button>
        <button onClick={() => handleTimer('reset')} className="border-2 border-brand-charcoal px-2 py-1">Reset</button>
        <button onClick={() => handleTimer('add10')} className="border-2 border-brand-charcoal px-2 py-1">+10s</button>
        <span className="tabular-nums">{lot.timerSeconds}s</span>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSold} disabled={!lot.currentBiddingTeamId} className="border-2 border-brand-charcoal px-3 py-1 bg-brand-blue text-brand-white disabled:opacity-40">
          SOLD
        </button>
        <button onClick={handleUnsold} className="border-2 border-brand-charcoal px-3 py-1">UNSOLD</button>
        <button onClick={handleUndo} className="border-2 border-brand-charcoal px-3 py-1 bg-brand-pink">UNDO</button>
      </div>
    </BrutalCard>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- live-lot-control` — expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/live-lot-control.tsx src/components/admin/live-lot-control.test.tsx
git commit -m "feat: LiveLotControl panel — bid increments, timer, sold/unsold/undo"
```

---

### Task 9: Team Purse Table & Bid Log

**Files:**
- Modify: `src/components/admin/team-purse-table.tsx` (replace stub)
- Modify: `src/components/admin/bid-log.tsx` (replace stub)
- Test: `src/components/admin/team-purse-table.test.tsx`

**Interfaces:**
- Produces: `TeamPurseTable({ teams, activeBiddingTeamId })` and `BidLog({ bidHistory })` — both pure presentational components, `teams: AdminSnapshot['teams']`, `bidHistory: AdminSnapshot['currentLot']['bidHistory']`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/team-purse-table.test.tsx
import { render, screen } from '@testing-library/react'
import { TeamPurseTable } from './team-purse-table'

const teams = [
  { id: 't1', name: 'Team A', shortCode: 'TMA', colorAccent: '#2074D5', purseRemaining: 9000, squadCount: 3, squadMax: 25, overseasSlotsUsed: 1, overseasSlotsMax: 8 },
  { id: 't2', name: 'Team B', shortCode: 'TMB', colorAccent: '#EB547C', purseRemaining: 8000, squadCount: 4, squadMax: 25, overseasSlotsUsed: 2, overseasSlotsMax: 8 },
]

describe('TeamPurseTable', () => {
  it('renders every team with purse and squad count', () => {
    render(<TeamPurseTable teams={teams} activeBiddingTeamId={null} />)
    expect(screen.getByText('Team A')).toBeInTheDocument()
    expect(screen.getByText('9000')).toBeInTheDocument()
    expect(screen.getByText('Team B')).toBeInTheDocument()
  })

  it('highlights the row for the currently bidding team', () => {
    render(<TeamPurseTable teams={teams} activeBiddingTeamId="t2" />)
    expect(screen.getByTestId('team-row-t2')).toHaveClass('bg-brand-blue')
    expect(screen.getByTestId('team-row-t1')).not.toHaveClass('bg-brand-blue')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- team-purse-table` — expected: FAIL (stub renders nothing).

- [ ] **Step 3: Implement both components**

```tsx
// src/components/admin/team-purse-table.tsx
import { BrutalCard } from '@/components/ui/brutal-card'
import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'

export function TeamPurseTable({
  teams,
  activeBiddingTeamId,
}: {
  teams: AdminSnapshot['teams']
  activeBiddingTeamId: string | null
}) {
  return (
    <BrutalCard className="w-64 flex flex-col gap-1">
      <h2 className="font-heading">Teams</h2>
      {teams.map((t) => (
        <div
          key={t.id}
          data-testid={`team-row-${t.id}`}
          className={`border-2 border-brand-charcoal px-2 py-1 flex justify-between ${t.id === activeBiddingTeamId ? 'bg-brand-blue text-brand-white' : ''}`}
        >
          <span>{t.name}</span>
          <span className="tabular-nums">{t.purseRemaining}</span>
          <span>{t.squadCount}/{t.squadMax}</span>
        </div>
      ))}
    </BrutalCard>
  )
}
```

```tsx
// src/components/admin/bid-log.tsx
import { BrutalCard } from '@/components/ui/brutal-card'
import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'

export function BidLog({ bidHistory }: { bidHistory: NonNullable<AdminSnapshot['currentLot']>['bidHistory'] }) {
  return (
    <BrutalCard>
      <h2 className="font-heading">Bid Log</h2>
      <ul className="flex flex-col gap-1">
        {bidHistory.map((b, i) => (
          <li key={i} className="tabular-nums">
            {b.teamName} — {b.amount} — {new Date(b.timestamp).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </BrutalCard>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- team-purse-table` — expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/team-purse-table.tsx src/components/admin/bid-log.tsx src/components/admin/team-purse-table.test.tsx
git commit -m "feat: TeamPurseTable and BidLog panels"
```

---

### Task 10: Keyboard Shortcuts & Final Integration

**Files:**
- Modify: `src/app/admin/[roomId]/admin-console.tsx`
- Modify: `src/app/admin/[roomId]/admin-console.test.tsx`

**Interfaces:**
- Consumes: `markSold`, `markUnsold`, `undoLastBid`, `controlTimer` (Tasks 4-5).
- Produces: a `keydown` listener on `AdminConsole` mapping Space→timer start/pause toggle, S→markSold, U→markUnsold, Z→undoLastBid, matching the spec's shortcut table exactly.

- [ ] **Step 1: Write the failing test**

```tsx
// append to src/app/admin/[roomId]/admin-console.test.tsx
import { fireEvent } from '@testing-library/react'

describe('AdminConsole keyboard shortcuts', () => {
  it('pressing S calls markSold when a lot is active', async () => {
    const actions = await import('./actions')
    const markSoldSpy = vi.spyOn(actions, 'markSold').mockResolvedValue(baseSnapshot)
    render(<AdminConsole roomId="room-1" initialSnapshot={{ ...baseSnapshot, currentLot: {
      id: 'lot-1', status: 'BIDDING', currentBid: 20, currentBiddingTeamId: 'team-1', timerSeconds: 30, bidHistory: [],
      player: { id: 'p1', name: 'X', role: 'BATTER', basePrice: 20, photoUrl: null, nationality: 'India', matches: 1, runs: null, wickets: null, average: null, strikeRate: null, economy: null },
    } }} />)
    fireEvent.keyDown(window, { key: 's' })
    await vi.waitFor(() => expect(markSoldSpy).toHaveBeenCalledWith('room-1'))
  })

  it('pressing Z calls undoLastBid', async () => {
    const actions = await import('./actions')
    const undoSpy = vi.spyOn(actions, 'undoLastBid').mockResolvedValue(baseSnapshot)
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    fireEvent.keyDown(window, { key: 'z' })
    await vi.waitFor(() => expect(undoSpy).toHaveBeenCalledWith('room-1'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- admin-console` — expected: FAIL, no keydown handler wired yet.

- [ ] **Step 3: Add the keyboard-shortcut effect**

```tsx
// add inside AdminConsole, in src/app/admin/[roomId]/admin-console.tsx
import { markSold, markUnsold, undoLastBid, controlTimer } from './actions'
// (add alongside the existing `setPhase` import)

useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (!snapshot.currentLot) return
    if (e.key === ' ') {
      e.preventDefault()
      controlTimer(roomId, snapshot.room.phase === 'PAUSED' ? 'start' : 'pause').then(setSnapshot)
    } else if (e.key.toLowerCase() === 's') {
      markSold(roomId).then(setSnapshot)
    } else if (e.key.toLowerCase() === 'u') {
      markUnsold(roomId).then(setSnapshot)
    } else if (e.key.toLowerCase() === 'z') {
      undoLastBid(roomId).then(setSnapshot)
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [roomId, snapshot])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- admin-console` — expected: PASS, all tests.

Then run the full suite and typecheck to confirm nothing regressed:

Run: `npm test` — expected: all tests across the whole project pass.
Run: `npm run typecheck` — expected: exit 0.
Run: `npm run build` — expected: completes with no type errors (may still warn about missing env vars at build time if `.env` isn't loaded in the build environment — note this in the report if so, it's not a regression this task introduces).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\[roomId\]/admin-console.tsx src/app/admin/\[roomId\]/admin-console.test.tsx
git commit -m "feat: keyboard shortcuts (Space/S/U/Z) wired to admin actions"
```

---

## Self-Review Notes

- **Spec coverage:** Header/phase/pause/end-with-confirm (Task 6), player queue search/filter/reorder-by-click-to-load (Task 7 — note: drag-to-reorder from the PRD's "drag-to-reorder within a set" is NOT implemented here, see below), live lot control with quick-increments/timer/SOLD-UNSOLD-UNDO (Task 8), team purse table with active-row highlight (Task 9), bid log backing undo (Task 9), keyboard shortcuts (Task 10). Realtime persistence + broadcast for every mutation (Tasks 1-5).
- **Deliberate scope cut:** the PRD's "drag-to-reorder within a set" for the player queue is not implemented — reordering the queue doesn't affect auction correctness (the queue is consumed in a fixed order via `advanceToNextLot`'s `orderBy: id asc`), and drag-and-drop is a meaningfully separate feature (needs a DnD library or hand-rolled pointer logic) that the PRD doesn't otherwise depend on. Flagging this explicitly rather than silently dropping it — pull it into its own follow-up task if the operator workflow needs manual reordering.
- **Type consistency:** `AdminSnapshot` (Task 2) is the single shape every later task's props and server-action return types use — verified consistent across Tasks 3-10.
- **No placeholders:** every step has runnable code and explicit pass/fail expectations. Task 6's stub components are a deliberate, explicitly-labeled bridge (not a placeholder left unfinished) — each stub is fully replaced by name-identical files in Tasks 7-9, so the codebase never ships with a stub.
