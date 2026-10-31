import { isUncapped, squadRejectionReason, type SquadPlayer } from '@/lib/team-rules'

// Bid ladder, in whole lakhs (see src/lib/money.ts) — the increment is set by
// the price the bidding has already reached, not by the raise.
const BID_TIERS = [
  { below: 200, step: 10 }, // up to ₹2 Cr  → 10 L
  { below: 500, step: 20 }, // ₹2–5 Cr      → 20 L
  { below: 1000, step: 50 }, // ₹5–10 Cr    → 50 L
]
const TOP_TIER_STEP = 100 // ₹10 Cr and above → 1 Cr

/** Two teams contest a lot at a time; a third joins only once one of them drops. */
export const MAX_ACTIVE_BIDDERS = 2

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
 * The teams still contesting the lot: everyone who has bid on it, in the order
 * they came in, minus the ones who dropped.
 */
export function activeBidders(bidTeamIds: string[], dropped: string[]): string[] {
  return [...new Set(bidTeamIds)].filter((id) => !dropped.includes(id))
}

export type BidTeam = {
  id: string
  purseRemaining: number
  squadMax: number
  overseasSlotsMax: number
  squad: SquadPlayer[]
}

export type BidLot = {
  currentBid: number
  status: string
  player: { role: string; isOverseas: boolean; setNumber: string }
  activeBidders: string[]
  droppedTeamIds: string[]
}

/**
 * Reason this team can't bid `amount` on this lot, or null if they can.
 * Shared by the server guard and the consoles' disabled-button labels, so the
 * UI never shows a dead button the server would have rejected anyway.
 */
export function bidRejectionReason(team: BidTeam, lot: BidLot, amount: number): string | null {
  if (lot.status === 'BIDDING' ? amount <= lot.currentBid : amount < lot.currentBid) return 'Bid below current price'
  if (amount > team.purseRemaining) return 'Purse insufficient'
  if (lot.droppedTeamIds.includes(team.id)) return 'You dropped out of this lot'
  if (lot.activeBidders.length >= MAX_ACTIVE_BIDDERS && !lot.activeBidders.includes(team.id)) {
    return 'Two teams are bidding — wait for one to drop'
  }
  return squadRejectionReason(
    team.squad,
    { role: lot.player.role, isOverseas: lot.player.isOverseas, uncapped: isUncapped(lot.player.setNumber) },
    { squadMax: team.squadMax, overseasMax: team.overseasSlotsMax }
  )
}
