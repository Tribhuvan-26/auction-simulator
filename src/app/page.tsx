import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { BrutalCard } from '@/components/ui/brutal-card'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const rooms = await prisma.auctionRoom.findMany({
    include: { teams: { orderBy: { name: 'asc' } }, _count: { select: { players: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <main className="flex-1 bg-brand-charcoal px-6 py-10 md:px-12">
      <header className="mb-10 max-w-4xl">
        <h1 className="font-heading text-5xl font-bold leading-[0.95] text-brand-white md:text-7xl">
          Auction
          <span className="ml-3 inline-block border-[3px] border-brand-white bg-brand-yellow px-3 text-brand-charcoal shadow-brutal-white">
            Live
          </span>
        </h1>
        <p className="mt-4 max-w-md text-brand-white/80">
          Pick a room, then open the seat you need. Run the auction from the console, bid from a team
          seat, or put the display on the big screen.
        </p>
      </header>

      {rooms.length === 0 && (
        <BrutalCard className="max-w-lg">
          <h2 className="font-heading text-xl font-bold">No rooms yet</h2>
          <p className="mt-2">
            Seed the demo data to get 8 teams and 40 players: run{' '}
            <code className="border-2 border-brand-charcoal bg-brand-yellow px-1">npx prisma db seed</code>.
          </p>
        </BrutalCard>
      )}

      <div className="flex flex-col gap-8">
        {rooms.map((room) => (
          <BrutalCard key={room.id} className="max-w-5xl">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-[3px] border-brand-charcoal pb-3">
              <h2 className="font-heading text-3xl font-bold">{room.name}</h2>
              <span className="border-[3px] border-brand-charcoal bg-brand-yellow px-3 py-1 font-heading font-bold">
                {room.phase}
              </span>
              <span className="text-sm">
                {room.teams.length} teams · {room._count.players} players · round {room.round}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/admin/${room.id}`}
                className="border-[3px] border-brand-charcoal bg-brand-blue px-4 py-2 font-heading font-bold text-brand-white shadow-brutal transition-transform hover:-translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-brutal-pressed"
              >
                Admin console
              </Link>
              <Link
                href={`/display/${room.id}`}
                className="border-[3px] border-brand-charcoal bg-brand-charcoal px-4 py-2 font-heading font-bold text-brand-white shadow-brutal transition-transform hover:-translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-brutal-pressed"
              >
                Big screen
              </Link>
            </div>

            <h3 className="mt-6 font-heading text-sm font-bold uppercase">Team seats</h3>
            <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              {room.teams.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/team/${room.id}/${t.id}`}
                    className="flex items-center justify-between gap-2 border-[3px] border-brand-charcoal px-3 py-2 shadow-brutal transition-transform hover:-translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-brutal-pressed"
                    style={{ borderLeftColor: t.colorAccent, borderLeftWidth: 10 }}
                  >
                    <span className="truncate font-heading font-bold">{t.name}</span>
                    <span className="font-heading text-xs">{t.shortCode}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </BrutalCard>
        ))}
      </div>
    </main>
  )
}
