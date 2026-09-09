import { BrutalCard } from '@/components/ui/brutal-card'
import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'
import { formatMoney } from '@/lib/money'
import { TriangleAlert } from 'lucide-react'

const LOW_PURSE_THRESHOLD = 0.15

export function TeamPurseTable({
  teams,
  activeBiddingTeamId,
}: {
  teams: AdminSnapshot['teams']
  activeBiddingTeamId: string | null
}) {
  return (
    <BrutalCard className="flex w-72 shrink-0 flex-col gap-2">
      <h2 className="font-heading text-xl font-bold">Teams</h2>
      {teams.map((t) => {
        const leading = t.id === activeBiddingTeamId
        const pursePercent = t.purseRemaining / t.purseTotal
        const squadFull = t.squadCount >= t.squadMax
        const lowPurse = pursePercent <= LOW_PURSE_THRESHOLD
        const atLimit = squadFull || lowPurse
        return (
          <div
            key={t.id}
            data-testid={`team-row-${t.id}`}
            className={`rounded-xl border-[3px] px-2 py-2 ${
              leading
                ? 'border-brand-charcoal bg-brand-blue text-brand-white'
                : atLimit
                  ? 'border-brand-pink'
                  : 'border-brand-charcoal'
            }`}
            style={leading ? undefined : { borderLeftColor: t.colorAccent, borderLeftWidth: 10 }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-heading font-bold">{t.name}</span>
              <span className="font-heading tabular-nums">{formatMoney(t.purseRemaining)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full border-2 border-brand-charcoal bg-brand-white">
              <div
                className={`h-full rounded-full ${leading ? 'bg-brand-yellow' : lowPurse ? 'bg-brand-pink' : 'bg-brand-blue'}`}
                style={{ width: `${Math.max(0, Math.round(pursePercent * 100))}%` }}
              />
            </div>
            <p className={`mt-1 flex items-center gap-1 text-xs ${atLimit && !leading ? 'font-bold text-brand-pink' : ''}`}>
              {atLimit && !leading && <TriangleAlert size={12} aria-hidden />}
              <span>
                {t.squadCount}/{t.squadMax}
              </span>{' '}
              squad · {t.overseasSlotsUsed}/{t.overseasSlotsMax} overseas
            </p>
          </div>
        )
      })}
    </BrutalCard>
  )
}
