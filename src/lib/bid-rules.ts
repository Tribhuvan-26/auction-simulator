import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'

/**
 * Reason this team can't bid `amount` on this lot, or null if they can.
 * Shared by the server guard below and the team console's disabled-button label,
 * so the UI never shows a dead button the server would have rejected anyway.
 */
export function bidRejectionReason(
  team: Pick<AdminSnapshot['teams'][number], 'purseRemaining' | 'squadCount' | 'squadMax' | 'overseasSlotsUsed' | 'overseasSlotsMax'>,
  lot: { currentBid: number; status: string; player: { isOverseas: boolean } },
  amount: number
): string | null {
  if (lot.status === 'BIDDING' ? amount <= lot.currentBid : amount < lot.currentBid) return 'Bid below current price'
  if (amount > team.purseRemaining) return 'Purse insufficient'
  if (team.squadCount >= team.squadMax) return 'Squad full'
  if (lot.player.isOverseas && team.overseasSlotsUsed >= team.overseasSlotsMax) return 'Overseas slots full'
  return null
}
