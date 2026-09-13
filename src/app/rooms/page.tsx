import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Matches the landing page's cinematic theme (src/app/page.tsx): dark navy
// ground, thin uppercase tracking, glass panels, Cormorant for the display
// type. No framer-motion here — hover/focus states are plain CSS, so the
// page stays a server component.
export default async function Rooms() {
  const rooms = await prisma.auctionRoom.findMany({
    include: { teams: { orderBy: { name: 'asc' } }, _count: { select: { players: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <main className="relative min-h-screen w-full bg-[#05070c] text-white">
      <CricketBackdrop />

      {/* Same top glow as the landing hero, so the two pages read as one scene. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_50%_-10%,rgba(32,116,213,0.28),transparent_65%)]" />

      <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-10 md:px-10">
        <nav className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- static logo asset, no next/image domain config needed */}
            <img src="/ipl-mark.png" alt="" aria-hidden className="h-6 w-auto" />
            <span className="font-heading text-xl font-light tracking-[0.1em]">IPL</span>
          </Link>
          <span className="font-body text-[11px] font-light uppercase tracking-[0.3em] text-white/45">
            Auction Simulator
          </span>
        </nav>

        <header className="mt-16 max-w-2xl">
          <p className="font-body text-[11px] font-light uppercase tracking-[0.35em] text-white/55">
            Choose your seat
          </p>
          <h1
            className="anim-shimmer-text mt-3 text-[clamp(2.75rem,7vw,5.5rem)] font-medium uppercase leading-[0.95] tracking-tight"
            style={{
              fontFamily: 'var(--font-luxury)',
              backgroundImage:
                'linear-gradient(100deg, #93a8c4 0%, #dce7f7 35%, #ffffff 45%, #ffffff 50%, #dce7f7 58%, #93a8c4 75%, #93a8c4 100%)',
              backgroundSize: '250% 100%',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Auction Rooms
          </h1>
          <p className="mt-5 max-w-[30rem] font-body text-[15px] font-light leading-relaxed text-white/55">
            Run the auction from the console, put the display on the big screen, or take a team seat
            and bid.
          </p>
        </header>

        {rooms.length === 0 && (
          <div className="mt-14 max-w-lg rounded-2xl border border-white/12 bg-white/[0.03] p-6">
            <h2 className="font-heading text-lg font-light uppercase tracking-[0.18em]">No rooms yet</h2>
            <p className="mt-3 font-body text-sm font-light text-white/60">
              Seed the demo data to get 10 teams and the full player pool: run{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/85">npx prisma db seed</code>.
            </p>
          </div>
        )}

        <div className="mt-14 flex flex-col gap-8">
          {rooms.map((room, i) => (
            <section
              key={room.id}
              className="group rounded-[22px] border border-white/12 bg-white/[0.03] p-6 transition duration-300 hover:border-white/25 hover:bg-white/[0.05] md:p-8"
            >
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex items-end gap-5">
                  <span
                    className="text-[3.25rem] font-light leading-none text-white/25 transition-colors duration-300 group-hover:text-white/45"
                    style={{ fontFamily: 'var(--font-luxury)' }}
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h2 className="font-heading text-2xl font-light uppercase tracking-[0.14em]">
                      {room.name}
                    </h2>
                    <p className="mt-2 font-body text-[11px] font-light uppercase tracking-[0.22em] text-white/45">
                      {room.teams.length} teams · {room._count.players} players · round {room.round}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-white/20 px-3 py-1 font-body text-[10px] font-light uppercase tracking-[0.28em] text-white/70">
                    {room.phase}
                  </span>
                  <Link
                    href={`/admin/${room.code}`}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-white/35 px-6 font-body text-[11px] font-light uppercase tracking-[0.26em] text-white transition hover:border-white/70 hover:shadow-[0_0_24px_2px_rgba(140,190,255,0.28)]"
                  >
                    Admin console
                    <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                  <Link
                    href={`/display/${room.code}`}
                    className="inline-flex h-11 items-center rounded-full border border-white/12 bg-white/[0.04] px-6 font-body text-[11px] font-light uppercase tracking-[0.26em] text-white/75 transition hover:border-white/35 hover:text-white"
                  >
                    Big screen
                  </Link>
                </div>
              </div>

              <h3 className="mt-6 font-body text-[10px] font-light uppercase tracking-[0.32em] text-white/40">
                Team seats
              </h3>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {room.teams.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/team/${room.code}/${t.shortCode}`}
                      className="flex h-full flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-4 text-center transition duration-300 hover:-translate-y-1 hover:border-white/30 hover:bg-white/[0.06]"
                      style={{ boxShadow: `inset 0 -2px 0 0 ${t.colorAccent}` }}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/90 p-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- static logo asset, no next/image domain config needed */}
                        <img
                          src={t.logoUrl ?? `/logos/${t.shortCode.toLowerCase()}.svg`}
                          alt=""
                          aria-hidden
                          className="h-full w-full object-contain"
                        />
                      </span>
                      <span className="font-body text-[11px] font-light leading-tight text-white/75">
                        {t.name}
                      </span>
                      <span className="font-heading text-[10px] font-light uppercase tracking-[0.28em] text-white/40">
                        {t.shortCode}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}

/**
 * Original cricket-ground backdrop, drawn here rather than photographed:
 * a floodlit stadium bowl seen from behind the bowler's arm. Everything is
 * SVG geometry — four pylons with light cones, the bowl and tiers, the 30-yard
 * ring and pitch in perspective, stumps at the far end, and an oversized ball
 * with its seam. Fixed behind the page, low contrast so the panels stay
 * readable. No photo, no canvas, no client JS.
 */
function CricketBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          {/* Night sky over the stadium rim. */}
          <linearGradient id="cb-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#05070c" />
            <stop offset="55%" stopColor="#0a1526" />
            <stop offset="100%" stopColor="#05070c" />
          </linearGradient>
          {/* The outfield: lit in the middle, falling to ink at the boundary. */}
          <radialGradient id="cb-turf" cx="50%" cy="82%" r="62%">
            <stop offset="0%" stopColor="#14304a" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#0a1a2b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#05070c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="cb-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bcd8ff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#bcd8ff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="cb-lamp">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#bcd8ff" stopOpacity="0" />
          </radialGradient>
          {/* Everything below the rim is a silhouette, so one soft mask keeps
              the whole scene from competing with the page content. */}
          <linearGradient id="cb-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.25" />
          </linearGradient>
          <mask id="cb-mask">
            <rect width="1600" height="900" fill="url(#cb-fade)" />
          </mask>
        </defs>

        <rect width="1600" height="900" fill="url(#cb-sky)" />

        <g mask="url(#cb-mask)">
          {/* Floodlight pylons: mast, lamp bank, halo, cone. */}
          {[
            { x: 210, h: 250 },
            { x: 520, h: 205 },
            { x: 1080, h: 205 },
            { x: 1390, h: 250 },
          ].map(({ x, h }) => (
            <g key={x}>
              <path
                d={`M ${x - 150},900 L ${x},${h + 70} L ${x + 150},900 Z`}
                fill="url(#cb-beam)"
              />
              <circle cx={x} cy={h + 30} r="120" fill="url(#cb-lamp)" opacity="0.35" />
              <rect x={x - 3} y={h + 40} width="6" height="420" fill="#9fb6d4" opacity="0.18" />
              <rect x={x - 46} y={h - 4} width="92" height="52" rx="4" fill="#0d1826" opacity="0.6" />
              {[0, 1, 2].map((row) =>
                [0, 1, 2, 3].map((col) => (
                  <circle
                    key={`${row}-${col}`}
                    cx={x - 30 + col * 20}
                    cy={h + 8 + row * 16}
                    r="4.5"
                    fill="#dbeaff"
                    opacity="0.3"
                  />
                )),
              )}
            </g>
          ))}

          {/* Stadium bowl: rim, upper tier, lower tier. */}
          <path d="M -200,900 C 60,470 520,360 800,360 C 1080,360 1540,470 1800,900 Z" fill="#070d16" opacity="0.92" />
          <path d="M -120,900 C 130,520 540,420 800,420 C 1060,420 1470,520 1720,900 Z" fill="#0a121d" opacity="0.95" />
          <path d="M -60,900 C 190,585 570,500 800,500 C 1030,500 1410,585 1660,900 Z" fill="#080e18" />
          {/* Crowd speckle on the tiers — dots on two arcs, not a texture file. */}
          {Array.from({ length: 90 }, (_, i) => {
            const t = i / 89
            const arc = i % 2 === 0 ? 455 : 530
            const x = -40 + t * 1680
            const y = arc + Math.pow(Math.abs(t - 0.5) * 2, 2.1) * 330
            return <circle key={i} cx={x} cy={y} r="2.2" fill="#9fb6d4" opacity="0.14" />
          })}

          {/* Outfield light pool, boundary rope, 30-yard ring — flattened
              ellipses read as ground plane seen from a low camera. */}
          <ellipse cx="800" cy="760" rx="900" ry="300" fill="url(#cb-turf)" />
          <ellipse cx="800" cy="765" rx="700" ry="225" fill="none" stroke="#dbeaff" strokeOpacity="0.10" strokeWidth="2" />
          <ellipse cx="800" cy="770" rx="400" ry="128" fill="none" stroke="#dbeaff" strokeOpacity="0.08" strokeWidth="2" strokeDasharray="14 12" />

          {/* Pitch in perspective, with popping creases at both ends. */}
          <path d="M 742,880 L 858,880 L 828,660 L 772,660 Z" fill="#dbeaff" opacity="0.07" />
          <path d="M 742,880 L 858,880 L 828,660 L 772,660 Z" fill="none" stroke="#dbeaff" strokeOpacity="0.12" strokeWidth="1.5" />
          <path d="M 754,822 L 846,822" stroke="#dbeaff" strokeOpacity="0.12" strokeWidth="1.5" />
          <path d="M 779,690 L 821,690" stroke="#dbeaff" strokeOpacity="0.12" strokeWidth="1.5" />

          {/* Stumps at the far end. */}
          <g stroke="#dbeaff" strokeOpacity="0.28" strokeWidth="2.5" strokeLinecap="round">
            <path d="M 792,678 V 656" />
            <path d="M 800,678 V 655" />
            <path d="M 808,678 V 656" />
            <path d="M 789,655 h 22" strokeWidth="2" />
          </g>

          {/* Oversized ball, off to one side: seam plus its stitching. */}
          <g transform="translate(1245 250)">
            <circle r="132" fill="#12202f" opacity="0.55" />
            <circle r="132" fill="none" stroke="#dbeaff" strokeOpacity="0.10" strokeWidth="1.5" />
            <path d="M -132,0 A 132,132 0 0 0 132,0" fill="#1a2a3c" opacity="0.35" />
            <path d="M -128,-32 C -60,18 60,18 128,-32" fill="none" stroke="#eb547c" strokeOpacity="0.30" strokeWidth="2.5" />
            <path
              d="M -120,-16 C -56,32 56,32 120,-16"
              fill="none"
              stroke="#eb547c"
              strokeOpacity="0.18"
              strokeWidth="2"
              strokeDasharray="3 13"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* Sink the scene's edges into the page ground. */}
        <rect width="1600" height="900" fill="url(#cb-vignette)" />
        <defs>
          <radialGradient id="cb-vignette" cx="50%" cy="60%" r="75%">
            <stop offset="0%" stopColor="#05070c" stopOpacity="0" />
            <stop offset="70%" stopColor="#05070c" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#05070c" stopOpacity="0.95" />
          </radialGradient>
        </defs>
      </svg>

      {/* Fine grain so the flat gradients do not band on a big screen. */}
      <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:3px_3px]" />
    </div>
  )
}
