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
          className={`border-2 border-brand-charcoal px-2 py-1 flex justify-between ${
            t.id === activeBiddingTeamId ? 'bg-brand-blue text-brand-white' : ''
          }`}
        >
          <span>{t.name}</span>
          <span className="tabular-nums">{t.purseRemaining}</span>
          <span>
            {t.squadCount}/{t.squadMax}
          </span>
        </div>
      ))}
    </BrutalCard>
  )
}
