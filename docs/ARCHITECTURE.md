# Auction Live — project teardown

A real-time IPL-style player auction: one auctioneer runs the room, ten team seats bid against each
other, and a big screen carries the lot. Postgres is the only source of truth; Socket.io exists
purely to tell every screen when to re-read it.

| | |
|---|---|
| Source | ~2,950 lines |
| Squads | 10 teams |
| Players | 254 |
| Photos | 247 |
| Tests | 42 passing, 9 files |

**Contents**

1. [The product](#1-the-product)
2. [Stack & repo map](#2-stack--repo-map)
3. [Data model](#3-data-model)
4. [Player data & seed](#4-player-data--seed)
5. [Server actions](#5-server-actions)
6. [Realtime layer](#6-realtime-layer)
7. [The three screens](#7-the-three-screens)
8. [Design system](#8-design-system)
9. [Tests, ops & gaps](#9-tests-ops--gaps)

---

## 1. The product

Auction Live runs a mock IPL mega-auction in a room full of people. It is not a game against a bot —
every seat is a real person on their own device, and the auctioneer decides when a player is sold.
The software's job is to keep all of those screens agreeing with each other.

### Three seats, one room

| Seat | Route | What it is |
|---|---|---|
| **Admin console** | `/admin/[roomId]` | The auctioneer. Loads the next player, raises bids on behalf of the room, works the timer, calls sold or unsold, undoes mistakes. |
| **Team seat** | `/team/[roomId]/[teamId]` | One per franchise. Shows the lot, your purse, your squad, and a single big Bid button that raises by 5 lakh. |
| **Big screen** | `/display/[roomId]` | Projector view. Player photo, live bid figure, countdown ring, who holds the lot, and the SOLD slam with confetti. |

The landing page at `/` lists every room in the database and hands out the links to all three — it's
the page you put on screen while people find their seats.

### The auction loop

1. Auctioneer hits **Load next player**. The first `UPCOMING` player becomes a `QUEUED` lot at their
   base price.
2. A team taps **Bid**, or the auctioneer clicks a +5 / +10 / +20 increment. The lot flips to
   `BIDDING`.
3. Every raise writes a `Bid` row and pushes the lot's `currentBid` and holder forward.
4. Going once, going twice — the auctioneer presses <kbd>S</kbd> for sold or <kbd>U</kbd> for unsold.
5. Sold debits the winning team's purse, files the player into their squad, and burns an overseas
   slot if the player is overseas.
6. Back to step one. The closed lot stays on screen until the next one is loaded.

> **House rule.** Money is stored everywhere as **whole lakhs** — `1` means ₹1,00,000. A team purse
> of `12000` is ₹120 crore. Only `formatMoney()` turns that into what an auctioneer actually says out
> loud: `35 L` under a crore, `1.2 Cr` above it.

---

## 2. Stack & repo map

Next.js 16 App Router with React 19. There is no REST API and no tRPC — the client calls Server
Actions directly, and each one returns a fresh snapshot of the whole room. Two processes run side by
side in development: the Next app on `:3000` and a standalone Socket.io server on `:4000`.

| Layer | Choice | Why it's there |
|---|---|---|
| Framework | Next.js 16.3.4 · React 19.2 | Server Actions are the entire write API; server components fetch the first snapshot. |
| Database | PostgreSQL 16 via Docker | Transactions matter — a sale moves the lot, the player and the purse together or not at all. |
| ORM | Prisma 7 + `@prisma/adapter-pg` | Driver adapter, so the client is constructed explicitly from `DATABASE_URL`. |
| Realtime | Socket.io 4.8 (client + server) | Rooms keyed by `roomId`; carries notifications only, never state. |
| Styling | Tailwind v4 (CSS-first `@theme`) | Brand tokens live in `globals.css`, not a JS config file. |
| Motion | GSAP · Framer Motion · CSS keyframes | Three tools, three jobs — split explained in part 8. |
| Tests | Vitest + Testing Library + jsdom | 9 files, 42 tests, hitting a real database. |

### Where everything lives

```
prisma/
  schema.prisma            5 models, 4 enums
  seed.ts                  builds a room: 10 teams + 254 players
  backfill-roles.ts        one-off role repair for old rooms
  data/
    ipl-2026-official-players.json
    player-roles.json      hand-curated, 254 entries
    ipl-2026-players.csv   original auction sheet
  migrations/              init + fk indexes/cascade
server/
  socket-server.ts         21 lines — join room, rebroadcast
src/app/
  page.tsx                 room directory / seat picker
  admin/[roomId]/
    actions.ts             the whole write API (~300 lines)
    admin-console.tsx      layout + keyboard shortcuts
  team/[roomId]/[teamId]/
    team-console.tsx       purse header, lot card, bid bar
  display/[roomId]/
    display-board.tsx      projector view
  globals.css              tokens, plates, grain, keyframes
src/components/
  admin/   player-queue · live-lot-control · team-purse-table · bid-log
  ui/      brutal-card · brutal-button · bid-number · countdown-ring
           sold-stamp · confetti-burst · team-chip · player-avatar
src/hooks/    use-live-snapshot · use-lot-entrance
src/lib/      bid-rules · money · prisma · socket-emitter · fonts · cn
public/players/  247 player photos (~38 MB)
```

---

## 3. Data model

Five tables. A **room** owns teams and players; a **lot** is one player put on the block, and it
holds the live price; **bids** are the append-only history behind that price.

| Model | Key fields | Role |
|---|---|---|
| `AuctionRoom` | `name` · `phase` · `round` · `currentLotId` | One auction event. `phase` cycles SETUP → LIVE → PAUSED → COMPLETED. |
| `Team` | `shortCode` · `colorAccent` · `purseTotal` · `purseRemaining` · `squadMin/Max` · `overseasSlotsUsed/Max` | A franchise seat. Seeded at ₹120 Cr, 25-player cap, 8 overseas slots. |
| `Player` | `role` · `basePrice` · `photoUrl` · `isOverseas` · `setNumber` · `status` · `soldPrice` · `teamId` | A lot-in-waiting. `status` is UPCOMING → LIVE → SOLD or UNSOLD. |
| `AuctionLot` | `playerId` (unique) · `currentBid` · `currentBiddingTeamId` · `status` · `timerSeconds` | The block itself. QUEUED → BIDDING → SOLD / UNSOLD. One lot per player, ever. |
| `Bid` | `lotId` · `teamId` · `amount` · `timestamp` | Append-only ladder. Undo deletes the newest row and rolls the lot back to the one beneath. |

### Enums

- `PlayerRole` — BATTER · BOWLER · ALL_ROUNDER · WICKET_KEEPER
- `PlayerStatus` — UPCOMING · LIVE · SOLD · UNSOLD
- `LotStatus` — QUEUED · BIDDING · SOLD · UNSOLD
- `RoomPhase` — SETUP · LIVE · PAUSED · COMPLETED

### Two migrations

`20260909065705_init` lays down the schema. `20260909072719_add_fk_indexes_and_cascade` adds the
foreign-key indexes and makes room deletion cascade, so dropping a test room doesn't strand its teams
and players.

> `AuctionRoom.currentLotId` exists in the schema but nothing reads or writes it. "The current lot"
> is derived instead — the newest lot in the room. See part 5.

---

## 4. Player data & seed

The player list is real. It was assembled from the ten official iplt20.com squad pages, merged with
the 2026 auction CSV for base price, nationality and capped status, and shipped with the squad photos
pulled off the same pages.

| File | Holds |
|---|---|
| `data/ipl-2026-official-players.json` | 254 players — name, team, base price, nationality, overseas flag, capped/uncapped, photo path. |
| `data/player-roles.json` | Name → role for all 254, curated by hand. |
| `data/ipl-2026-players.csv` | The original auction sheet the base prices came from. |
| `public/players/*.png` | 247 photos, named `<team-code>-<player-slug>.png`. Seven players have none and fall back to initials. |

### Why roles are a separate file

Neither source carries a role column — the iplt20.com squad cards are a name and a photo, and role
filtering happens client-side from data that isn't in the saved page. The seed used to paper over
that by cycling the four roles by array index, which is how Shreyas Iyer ended up billed as a bowler.
Roles are now curated in `player-roles.json` and the seed **throws** if any player in the dataset is
missing from it, so the two files can't drift apart silently.

### What the seed builds

- One room, *IPL 2026 Auction*, in `SETUP`.
- Ten teams with real short codes and brand colours, each on ₹120 Cr with a 25-player cap and 8
  overseas slots.
- 254 players as `UPCOMING`, split into two sets — *Capped Players* and *Uncapped Players*.

Career stats (`matches`, `runs`, `wickets`, averages) are not in any source yet, so they seed as zero
or null and the interfaces hide them rather than print a fabricated "0 matches".

```bash
# fresh room
npx prisma db seed

# repair a room seeded before roles were curated
npx tsx -r dotenv/config prisma/backfill-roles.ts
```

---

## 5. Server actions

`src/app/admin/[roomId]/actions.ts` is the entire write API. Every mutation ends the same way: commit
a transaction, fire a socket event, and return `getAdminSnapshot(roomId)` — one object describing the
room, the current lot with its bid history, all ten teams with squads and purses, the upcoming queue,
and the last twelve sales. All three screens consume that same shape.

| Action | Does | Emits |
|---|---|---|
| `getAdminSnapshot` | Reads the room. The only read the UI ever makes. | — |
| `advanceToNextLot` | First UPCOMING player → new QUEUED lot at base price. Refuses if a lot is still open. | `LOT_CHANGE` |
| `placeBid` | Re-checks the bid rules, writes a Bid row, moves the lot to BIDDING. | `BID` |
| `markSold` | Lot → SOLD, player → team squad at `soldPrice`, purse debited, overseas slot burned. One transaction. | `SOLD` |
| `markUnsold` | Lot and player → UNSOLD. No money moves. | `UNSOLD` |
| `undoLastBid` | Deletes the newest bid, rolls price and holder back to the one beneath — or to base price if none remain. | `UNDO` |
| `controlTimer` | start · pause · reset (30s) · add10. | `TIMER` |
| `setPhase` | LIVE · PAUSED · COMPLETED. | `PHASE` |

### The bid rules

`src/lib/bid-rules.ts` exports one function, `bidRejectionReason()`, returning the reason a team
can't bid — or `null`. It is called in two places on purpose: the team console uses it to label the
disabled Bid button, and `placeBid` calls it again on the server. Team consoles are untrusted
clients, so the button being disabled is a courtesy, not a guarantee.

- **Bid below current price** — must exceed `currentBid` once bidding has opened; may equal it on the
  opening bid.
- **Purse insufficient** — the amount exceeds `purseRemaining`.
- **Squad full** — `squadCount >= squadMax`.
- **Overseas slots full** — an overseas player when `overseasSlotsUsed >= overseasSlotsMax`.

### Which lot is "the" lot

There is no pointer column in play, so every action resolves the current lot by query: the newest lot
in the room, ordered by `id` descending, since cuids sort chronologically. `getAdminSnapshot` takes
the newest lot *regardless of status*, so a just-sold player stays on screen until the auctioneer
moves on; the mutations narrow to `QUEUED` or `BIDDING`. Both land on the same row.

> **Invariant.** A room may only ever have **one** open lot. `advanceToNextLot` returns early if one
> is still QUEUED or BIDDING. Without that guard two lots could sit open at once, and the actions —
> which all ask for "the" active lot — would resolve a different one than the console was showing,
> landing bids on the wrong player.

---

## 6. Realtime layer

The socket carries *notifications, not state*. An event says "something happened in this room"; every
screen answers by re-reading the snapshot from the database. That's one extra round trip per event,
which is nothing at auction pace, and it means no screen can drift out of sync by mis-applying a
patch.

### The server — 21 lines

```ts
io.on('connection', (socket) => {
  socket.on('room:join', (roomId) => socket.join(roomId))
  socket.on('auction:event', ({ roomId, payload }) =>
    socket.to(roomId).emit('auction:event', payload))
})
```

It has no database access and no auction logic. It is a fan-out relay, and the room is the channel.

### Emitting — deliberately fail-open

`src/lib/socket-emitter.ts` is called by server actions *after* the database write has already
committed. So a dead socket server must never throw or hang the mutation: it logs, gives up after 3
seconds, and resolves. The acting user still gets their fresh snapshot as the action's return value;
other screens simply miss the live push until the relay comes back.

### Consuming — `useLiveSnapshot`

One hook, used by all three screens. It joins the room, and on every event calls the snapshot fetcher
and swaps in the result. An optional `onEvent` callback fires first, from inside the socket handler,
for the transient reactions a snapshot can't express — the SOLD stamp, the bid pulse, the "you've
been outbid" toast. Those are moments, not state, and they'd be gone by the next re-read.

**Event vocabulary:** `BID` · `SOLD` · `UNSOLD` · `UNDO` · `TIMER` · `PHASE` · `LOT_CHANGE`

---

## 7. The three screens

### Admin console

Four panels across a charcoal ground: the queue, the live lot control, the team purse table, and the
bid log along the bottom. The room header carries the phase badge, pause/resume, and an *End auction*
confirmation modal.

- **Player queue** — search by name, filter by role, photo thumbnails, and the *Load next player*
  button.
- **Live lot control** — the player on the block, +5 / +10 / +20 increments against a chosen team,
  timer controls, sold/unsold/undo. Rejected bids surface their reason inline instead of failing
  silently.
- **Team purse table** — ten rows, purse remaining, squad count, overseas count, with the team
  currently holding the lot highlighted.
- **Bid log** — the ladder for the current lot.

Keyboard: <kbd>Space</kbd> pause/resume · <kbd>S</kbd> sold · <kbd>U</kbd> unsold · <kbd>Z</kbd>
undo. Suppressed while focus is in an input, select or textarea.

### Team seat

Built for one thumb on a phone. A coloured header carries the team name, purse remaining as a figure
and a bar, and the squad and overseas counts. The lot card sits in the middle; the squad list below
it. The bottom of the screen is one full-width button that reads **Bid 40 L** — the actual next
amount, not the increment. When a rule blocks the bid, the button is disabled and wears the reason.
Toasts announce taking the lead and being outbid, tracked through a ref so a team is only told it was
outbid if it was actually leading.

### Big screen

Full-viewport, dark, no scroll. The player photo is the focal point, with name, role and nationality
beneath and a stat row that prints a dash where a figure is unknown. The bid figure ticks up digit by
digit; the countdown ring runs amber, turns pink under 5 seconds and pulses under 3. The team holding
the lot slides in as a coloured chip and slides out when it changes. On a sale the screen flashes
white, the SOLD stamp slams down and confetti bursts in brand colours — four seconds, then back to
the lot.

---

## 8. Design system

The look is neo-brutalist — thick charcoal borders, hard offset shadows, flat brand colour — with a
layer of depth on top so importance reads before any text does.

| Token | Value | Carries |
|---|---|---|
| `brand-blue` | `#2074D5` | Active lot, primary actions, admin identity |
| `brand-yellow` | `#F9D47B` | Base price, sold, phase badges |
| `brand-pink` | `#EB547C` | Urgency, errors, destructive actions |
| `brand-charcoal` | `#282828` | Every border, every shadow, the dark ground |
| `shadow-brutal` | `4px 4px 0` | Resting state · `-lg` 8px lifted · `-pressed` 1px |
| `shadow-glow-*` | hard shadow + soft bloom | Lit surfaces — the crisp offset stays, a colour bloom stacks behind it |

Type is **Space Grotesk** for headings and figures, **Inter** for body, both via `next/font`. Three
CSS utilities carry the depth: `.layer-plate` offsets a solid colour plate behind a card via
`::before`, so surfaces read as stacked cardboard; `.bg-grain` lays a film of noise over dark
grounds; `.bg-spotlight` puts a soft pool of light behind the lot.

### Three motion tools, three jobs

| Tool | Owns | Examples |
|---|---|---|
| CSS keyframes | Steady and looping | bid pop, timer urgency pulse, marquee |
| GSAP | One-shot timelines | SOLD stamp, confetti, lot entrance, bid counter tick |
| Framer Motion | Mount / unmount | Toasts, the end-auction modal, team chip swap |

Every one of them checks `prefers-reduced-motion` and snaps to the final state instead of animating.

**Component kit:** `BrutalCard` (default / active / sold / unsold / pressed) · `BrutalButton` (blue /
yellow / pink / plain / dark, with a real physical press) · `BidNumber` · `CountdownRing` ·
`SoldStamp` · `ConfettiBurst` · `TeamChip` · `PlayerAvatar` (photo, else initials on a gradient).

---

## 9. Tests, ops & gaps

### Tests — 9 files, 42 tests

The action and seed tests run against a **real Postgres database**, creating and tearing down their
own rooms. There are no Prisma mocks, so a broken query fails the suite rather than passing against a
fake.

| Suite | Covers |
|---|---|
| `actions.test.ts` | Snapshot shape, every mutation, bid rejection, the one-open-lot invariant. |
| `seed.test.ts` | 10 teams, 254 players, curated roles, set split. |
| `socket-server.test.ts` | Room join and rebroadcast against an ephemeral server. |
| `socket-emitter.test.ts` | The fail-open path — a dead relay must not throw. |
| `admin-console` · `live-lot-control` · `player-queue` · `team-purse-table` · `brutal-card` | Rendering and interaction, via Testing Library. |

### Running it

```bash
npm install
docker compose up -d db          # postgres 16 on :5432
npx prisma migrate dev
npx prisma db seed

npm run dev                      # app      :3000
npm run socket-server            # relay    :4000

npm run typecheck                # tsc --noEmit
npm test                         # vitest run
```

Three environment variables, copied from `.env.example`: `DATABASE_URL`, `NEXT_PUBLIC_SOCKET_URL`,
`SOCKET_PORT`.

### Known gaps

- **No career stats.** `matches`, `runs`, `wickets`, `average`, `strikeRate` and `economy` are seeded
  empty. The screens hide them, so the display board's stat row currently reads as four dashes.
  Filling it needs a scrape the squad pages can't supply.
- **Timer is a number, not a clock.** `timerSeconds` is stored and nudged by `controlTimer`, but
  nothing counts it down server-side and nothing auto-closes a lot. The countdown ring renders the
  number it is given; the auctioneer is the clock.
- **No auth.** Anyone with a team URL can bid as that team. Fine for a room where everyone is in the
  room; not fine anywhere else.
- **Unused schema column.** `AuctionRoom.currentLotId` is never read or written. Either wire it up or
  drop it — right now it's a comment pretending to be a column.
