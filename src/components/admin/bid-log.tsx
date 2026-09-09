import { BrutalCard } from '@/components/ui/brutal-card'
import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'

export function BidLog({ bidHistory }: { bidHistory: NonNullable<AdminSnapshot['currentLot']>['bidHistory'] }) {
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
              className={`border-[3px] border-brand-charcoal px-2 py-1 text-sm ${i === 0 ? 'bg-brand-yellow' : ''}`}
            >
              <span className="font-heading font-bold">{b.teamName}</span>{' '}
              <span className="tabular-nums">{b.amount}</span>{' '}
              <span className="text-xs">{new Date(b.timestamp).toLocaleTimeString()}</span>
            </li>
          ))}
        </ol>
      )}
    </BrutalCard>
  )
}
