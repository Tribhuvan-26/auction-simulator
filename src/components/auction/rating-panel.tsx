import ratings from '@/data/player-ratings.json'

const TIERS = [
  { min: 90, label: 'ELITE', color: '#F9D47B' },
  { min: 80, label: 'STAR', color: '#2074D5' },
  { min: 70, label: 'SOLID', color: '#EB547C' },
  { min: 0, label: 'PROSPECT', color: '#FFFFFF' },
]

export function ratingFor(name: string): number | null {
  return (ratings as Record<string, number>)[name] ?? null
}

/** The big player-rating readout that replaced the stats graph. */
export function RatingPanel({ name, compact = false }: { name: string; compact?: boolean }) {
  const rating = ratingFor(name)
  const tier = rating === null ? null : TIERS.find((t) => rating >= t.min)!
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 border border-white/10 bg-[#161619] p-3">
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">RATING</span>
      <span
        className={`font-condensed font-black leading-none tabular-nums ${compact ? 'text-[7vh]' : 'text-7xl sm:text-8xl'}`}
        style={{ color: tier?.color ?? 'rgba(255,255,255,0.25)' }}
      >
        {rating ?? '—'}
      </span>
      <div className="h-1.5 w-full max-w-[160px] bg-white/10">
        <div className="h-full" style={{ width: `${rating ?? 0}%`, backgroundColor: tier?.color }} />
      </div>
      <span className="font-mono text-[10px] font-black uppercase tracking-widest text-white/70">
        {tier?.label ?? 'UNRATED'}
      </span>
    </div>
  )
}

/** Rating as a small tile, to sit beside the current bid. */
export function RatingTile({ name }: { name: string }) {
  const rating = ratingFor(name)
  const tier = rating === null ? null : TIERS.find((t) => rating >= t.min)!
  return (
    <div className="flex min-w-[96px] flex-col items-center justify-center border border-white/10 bg-[#161619] px-3 py-2">
      <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-white/50">RATING</span>
      <span
        className="font-condensed text-4xl font-black leading-none tabular-nums sm:text-5xl"
        style={{ color: tier?.color ?? 'rgba(255,255,255,0.25)' }}
      >
        {rating ?? '—'}
      </span>
      <span className="mt-0.5 font-mono text-[8px] font-black uppercase tracking-widest text-white/70">
        {tier?.label ?? 'UNRATED'}
      </span>
    </div>
  )
}
