import { BrutalCard } from '@/components/ui/brutal-card'
import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'
import { formatMoney } from '@/lib/money'

export function BidLog({
  bidHistory,
  teams,
}: {
  bidHistory: NonNullable<AdminSnapshot['currentLot']>['bidHistory']
  teams: AdminSnapshot['teams']
}) {
  return (
    <BrutalCard>
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-xl font-bold">Bid log</h2>
        <span className="text-xs">Undo pops the last entry</span>
      </div>
      {bidHistory.length === 0 ? (
        <p className="mt-1 text-sm">No bids on this lot yet.</p>
      ) : (
        <ol className="mt-2 flex flex-wrap gap-2">
          {[...bidHistory].reverse().map((b, i) => (
            <li
              key={`${b.timestamp}-${i}`}
              className={`flex items-center gap-2 rounded-xl border-[3px] border-brand-charcoal px-2 py-1 text-sm ${i === 0 ? 'bg-brand-yellow' : ''}`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-brand-charcoal/40"
                style={{ backgroundColor: teams.find((t) => t.id === b.teamId)?.colorAccent }}
                aria-hidden
              />
              <span className="font-heading font-bold">{b.teamName}</span>
              <span className="tabular-nums">{formatMoney(b.amount)}</span>
              <span className="text-xs opacity-70">{new Date(b.timestamp).toLocaleTimeString()}</span>
            </li>
          ))}
        </ol>
      )}
    </BrutalCard>
  )
}
