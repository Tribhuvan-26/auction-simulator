import { BrutalCard } from '@/components/ui/brutal-card'
import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'

export function BidLog({ bidHistory }: { bidHistory: NonNullable<AdminSnapshot['currentLot']>['bidHistory'] }) {
  return (
    <BrutalCard>
      <h2 className="font-heading">Bid Log</h2>
      <ul className="flex flex-col gap-1">
        {bidHistory.map((b, i) => (
          <li key={i} className="tabular-nums">
            {b.teamName} — {b.amount} — {new Date(b.timestamp).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </BrutalCard>
  )
}
