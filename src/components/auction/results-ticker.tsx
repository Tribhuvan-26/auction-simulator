import type { PublicSnapshot } from '@/app/admin/[roomId]/actions'
import { formatMoney } from '@/lib/money'

type Result = PublicSnapshot['resultLog'][number]

/** Charcoal or white text, whichever reads on this team colour. */
function inkOn(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 150 ? '#282828' : '#ffffff'
}

function Entry({ r }: { r: Result }) {
  const sold = r.status === 'SOLD' && r.teamShortCode
  return (
    <span className="flex items-center gap-3 pr-12">
      <span className="uppercase">{r.playerName}</span>
      <span aria-hidden className="text-brand-charcoal/40">→</span>
      {sold ? (
        <>
          <span
            className="border-[3px] border-brand-charcoal px-2 leading-tight"
            style={{ backgroundColor: r.colorAccent ?? '#2074D5', color: inkOn(r.colorAccent ?? '#2074D5') }}
          >
            {r.teamShortCode}
          </span>
          <span className="tabular-nums">{formatMoney(r.price ?? 0)}</span>
        </>
      ) : (
        <span className="border-[3px] border-brand-charcoal bg-brand-pink px-2 leading-tight text-white">UNSOLD</span>
      )}
      <span aria-hidden className="pl-9 text-brand-charcoal/30">•</span>
    </span>
  )
}

/**
 * News-channel strip pinned to the bottom of the big screen: every closed lot,
 * newest first. The list is rendered twice and slid by -50%, so the loop is
 * seamless; `.anim-marquee` already stops under prefers-reduced-motion.
 */
export function ResultsTicker({ results }: { results: Result[] }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-stretch border-t-4 border-brand-charcoal bg-brand-white font-condensed text-3xl font-black text-brand-charcoal">
      <span className="z-10 flex shrink-0 items-center border-r-4 border-brand-charcoal bg-brand-yellow px-5 tracking-wider">
        RESULTS
      </span>
      <div className="flex min-w-0 flex-1 items-center overflow-hidden">
        {results.length === 0 ? (
          <span className="px-6 uppercase text-brand-charcoal/60">Auction starting soon</span>
        ) : (
          <div
            className="anim-marquee flex w-max whitespace-nowrap"
            // ~5s per entry keeps the reading speed constant as the list grows.
            style={{ animationDuration: `${Math.max(20, results.length * 5)}s` }}
          >
            {[0, 1].map((copy) => (
              <div key={copy} className="flex" aria-hidden={copy === 1 || undefined}>
                {results.map((r) => (
                  <Entry key={r.id} r={r} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
