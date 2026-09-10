/**
 * Auction clock in the broadcast format the Neo-Grid spec calls for —
 * `00:01:30`, hours:minutes:seconds, always padded. Timers here are stored as
 * whole seconds remaining on the lot.
 */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}
