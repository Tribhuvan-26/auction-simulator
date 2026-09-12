import Link from 'next/link'

// Keep copy easy to swap without touching layout.
const CONTENT = {
  eyebrow: 'IPL AUCTION SIMULATOR',
  title: 'AUCTION',
  tagline: 'BUILD YOUR DREAM SQUAD',
  description:
    'Step into the IPL auction arena, where\nstrategy meets passion. Pick your team,\nbid for the best, and build a champion.',
  cta: 'START AUCTION',
  stats: ['10 TEAMS', '250+ PLAYERS', 'UNLIMITED POSSIBILITIES'],
}

const STRIP_TEAMS = ['mi', 'csk', 'rcb', 'kkr', 'dc', 'rr', 'srh', 'gt']

// Hero frame geometry, lifted directly off the reference screenshot
// (1536x1024) so the composition matches rather than being eyeballed.
const GEOMETRY = {
  '--hero-left': '4%',
  '--hero-right': '6%',
  '--hero-top': '18%',
  '--hero-bottom': '8%',
  '--hero-radius': '28px',
  '--content-width': '46%',
  '--glass-opacity': '0.03',
} as React.CSSProperties

export default function Landing() {
  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#05070c] text-white" style={GEOMETRY}>
      {/* The reference screenshot's own photograph, cropped to just the
          stadium/batter/ball region (no baked-in text) so it stays
          photographic instead of redrawn as vector/illustration art. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static hero photo, no next/image domain config needed */}
      <img
        src="/hero-photo.webp"
        alt=""
        aria-hidden
        className="absolute inset-y-0 right-0 h-full w-[62%] object-cover object-[30%_18%]"
      />

      {/* Dark navy backdrop + left-to-right fade so the crop blends into a
          full-bleed scene instead of reading as a pasted rectangle. */}
      <div className="absolute inset-0 -z-10 bg-[#050a12]" />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,#05070c_0%,#05070c_42%,rgba(5,7,12,0.45)_54%,rgba(5,7,12,0.08)_66%,transparent_78%)]" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#05070c] to-transparent" />

      {/* ── Foreground content ── */}
      <div className="relative z-10 h-full">
        <nav className="absolute inset-x-0 top-0 flex items-center justify-between px-6 pt-8 md:px-12">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- static logo asset, no next/image domain config needed */}
            <img src="/ipl-mark.png" alt="" aria-hidden className="h-6 w-auto" />
            <span className="font-heading text-xl font-light tracking-[0.1em]">IPL</span>
          </div>
        </nav>

        {/* Glass hero container — bounds come from the CSS vars above.
            Absolutely positioned so top/bottom percentages resolve against
            height (margin percentages resolve against width for every box,
            including margin-top/bottom — that was the alignment bug). No
            border stroke — the reference's own card outline is baked into
            its photo, not a real border, so drawing our own just doubled it.
            No backdrop-blur either — it sat on the same box as all the text/
            button/logo children, and browsers can blur that whole composited
            layer (not just what's behind it) at fractional zoom, which is
            why everything but the background photo looked soft on zoom. */}
        <div
          className="absolute overflow-hidden rounded-[var(--hero-radius)] bg-white/[var(--glass-opacity)]"
          style={{
            left: 'var(--hero-left)',
            right: 'var(--hero-right)',
            top: 'var(--hero-top)',
            bottom: 'var(--hero-bottom)',
          }}
        >
          <div className="flex h-full flex-col px-8 py-8 md:px-12 md:py-10">
            <div style={{ maxWidth: 'var(--content-width)', minWidth: 280 }}>
              <p className="font-body text-[12px] font-light uppercase tracking-[0.35em] text-white/70">
                {CONTENT.eyebrow}
              </p>

              <h1
                className="mt-2 text-[clamp(3.5rem,10.5vw,9rem)] font-medium uppercase leading-[0.92] tracking-tight"
                style={{
                  fontFamily: 'var(--font-luxury)',
                  backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #dce7f7 40%, #93a8c4 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  WebkitTextStroke: '1px rgba(255,255,255,0.9)',
                  textShadow: '0 0 40px rgba(200,220,255,0.35), 0 0 2px rgba(255,255,255,0.4)',
                }}
              >
                {CONTENT.title}
              </h1>

              <p className="mt-4 flex items-center gap-3 font-body text-xs font-light uppercase tracking-[0.3em] text-white/85">
                <span className="h-px w-7 bg-white/40" />
                {CONTENT.tagline}
                <span className="h-px w-7 bg-white/40" />
              </p>

              <p className="mt-5 max-w-[24rem] whitespace-pre-line font-body text-[15px] font-light leading-relaxed text-white/60">
                {CONTENT.description}
              </p>

              <Link
                href="/rooms"
                className="group mt-7 inline-flex h-[60px] w-[240px] items-center justify-center gap-3 rounded-full border border-white/35 bg-white/[0.02] font-body text-xs font-light uppercase tracking-[0.28em] text-white shadow-[0_0_0_0_rgba(140,190,255,0)] transition hover:border-white/70 hover:shadow-[0_0_28px_2px_rgba(140,190,255,0.3)]"
              >
                {CONTENT.cta}
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>

            {/* Bottom-left stats */}
            <div className="mt-auto flex flex-wrap items-center gap-3 font-body text-[12px] font-light uppercase tracking-[0.22em] text-white/70">
              {CONTENT.stats.map((s, i) => (
                <span key={s} className="flex items-center gap-3">
                  {i > 0 && <span className="h-3 w-px bg-white/25" aria-hidden />}
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Team logo strip — the app's own official team logo SVGs
              (public/logos), not a raster crop. */}
          <div className="absolute bottom-7 right-7 hidden items-center rounded-2xl border border-white/15 bg-black/55 px-3 py-2.5 shadow-lg md:flex">
            {STRIP_TEAMS.map((code, i) => (
              <div key={code} className="flex items-center">
                {i > 0 && <span className="mx-3 h-9 w-px bg-white/15" aria-hidden />}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 p-1 transition-transform duration-300 hover:scale-110">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static logo asset, no next/image domain config needed */}
                  <img
                    src={`/logos/${code}.svg`}
                    alt={code.toUpperCase()}
                    className="h-full w-full object-contain opacity-90 transition hover:opacity-100"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
