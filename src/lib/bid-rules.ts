import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'

// IPL bid ladder, in whole lakhs (see src/lib/money.ts) — the increment is set
// by the price the bidding has already reached, not by the raise.
const BID_TIERS = [
  { below: 100, step: 5 },  // under ₹1 Cr  → 5 L
  { below: 200, step: 10 }, // under ₹2 Cr  → 10 L
  { below: 500, step: 20 }, // under ₹5 Cr  → 20 L
]
const TOP_TIER_STEP = 25 // ₹5 Cr and above → 25 L

/**
 * The one legal amount a team may bid next. Below the base price the ladder
 * hasn't started, so the next bid is the base price itself; from there it's
 * the current bid plus its tier's increment.
 */
export function getNextBidAmount(currentBid: number, basePrice: number): number {
  if (currentBid < basePrice) return basePrice
  const tier = BID_TIERS.find((t) => currentBid < t.below)
  return currentBid + (tier ? tier.step : TOP_TIER_STEP)
}

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
