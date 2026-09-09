# Auction Live

Foundation for a real-time IPL-style auction platform (Next.js + Prisma + Socket.io).

## Local dev setup

```bash
npm install
docker compose up -d db
npx prisma migrate dev
npx prisma db seed
```

Then, in separate terminals:

```bash
npm run dev            # Next.js app (http://localhost:3000)
npm run socket-server  # Socket.io server (http://localhost:4000)
```

## Other scripts

```bash
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run lint       # eslint
npm run build      # next build
```

Copy `.env.example` to `.env` and adjust `DATABASE_URL`, `NEXT_PUBLIC_SOCKET_URL`, and `SOCKET_PORT` as needed.

## Architecture

Full teardown of the system, in nine parts: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
