import type { PublicSnapshot } from '@/app/admin/[roomId]/actions'

/**
 * What the server broadcasts after every change. The event carries the new
 * state itself, so a screen updates straight from the message instead of
 * every screen in the room refetching the same snapshot at once.
 *
 * A bid only moves the lot, so BID carries just that; everything else can
 * touch purses, squads or the ticker, so it carries the whole public snapshot.
 * `at` is when the server read that state — screens drop anything older than
 * what they already show, since two broadcasts can arrive out of order.
 */
export type LiveEvent =
  | { type: 'BID'; teamId: string; amount: number; at: number; lot: PublicSnapshot['currentLot'] }
  | { type: 'SOLD' | 'UNSOLD' | 'UNDO' | 'TIMER' | 'PHASE' | 'LOT_CHANGE' | 'DROP'; at: number; snapshot: PublicSnapshot }
  /** The auctioneer replaying the sold animation: nothing in the room changed. */
  | { type: 'REPLAY'; at: number; lotId: string }

/**
 * The snapshot after this event, or null when the event can't be applied
 * (no payload — refetch instead). Keeps fields the event doesn't carry, such
 * as the admin console's queue.
 */
export function applyLiveEvent<T extends PublicSnapshot>(prev: T, event: LiveEvent): T | null {
  if (event.type === 'REPLAY') return prev
  if (typeof event.at !== 'number') return null
  if (prev.at >= event.at) return prev
  if (event.type === 'BID') return event.lot === undefined ? null : { ...prev, currentLot: event.lot, at: event.at }
  return event.snapshot ? { ...prev, ...event.snapshot } : null
}

/**
 * An action's result, unless a newer broadcast already landed while it was in
 * flight. A bid answers with just the lot; everything else with the whole room.
 */
export function newer<T extends PublicSnapshot>(prev: T, next: Pick<PublicSnapshot, 'at'> & Partial<PublicSnapshot>): T {
  return next.at >= prev.at ? { ...prev, ...next } : prev
}
