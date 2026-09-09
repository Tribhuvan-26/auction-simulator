import { BrutalCard } from '@/components/ui/brutal-card'
import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'
import { formatMoney } from '@/lib/money'

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
        return (
          <div
            key={t.id}
            data-testid={`team-row-${t.id}`}
            className={`border-[3px] border-brand-charcoal px-2 py-2 ${
              leading ? 'bg-brand-blue text-brand-white' : ''
            }`}
            style={leading ? undefined : { borderLeftColor: t.colorAccent, borderLeftWidth: 10 }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-heading font-bold">{t.name}</span>
              <span className="font-heading tabular-nums">{formatMoney(t.purseRemaining)}</span>
            </div>
            <div className="mt-1 h-2 border-2 border-brand-charcoal bg-brand-white">
              <div
                className={leading ? 'h-full bg-brand-yellow' : 'h-full bg-brand-blue'}
                style={{ width: `${Math.max(0, Math.round((t.purseRemaining / t.purseTotal) * 100))}%` }}
              />
            </div>
            <p className="mt-1 text-xs">
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
