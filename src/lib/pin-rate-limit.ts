import { headers } from 'next/headers'

const MAX_FAILURES = 5
const BLOCK_MS = 15 * 60 * 1000

type Record_ = { failures: number; blockedUntil: number }

/**
 * ponytail: in-process Map, so the count resets on redeploy and each instance
 * counts separately. Fine for one Next server driving a room; move to a table
 * or Redis if this ever runs behind more than one process.
 */
const attempts = new Map<string, Record_>()

/** The caller's IP, as far as the proxy in front of us reports it. */
export async function callerKey(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  return (forwarded?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim()
}

/** Minutes left on this caller's block, or 0 if they may try. */
export function blockedFor(key: string, now = Date.now()): number {
  const record = attempts.get(key)
  if (!record || record.blockedUntil <= now) return 0
  return Math.ceil((record.blockedUntil - now) / 60000)
}

/** Count a wrong PIN. Returns the block length in minutes once it trips. */
export function recordFailure(key: string, now = Date.now()): number {
  const record = attempts.get(key) ?? { failures: 0, blockedUntil: 0 }
  record.failures += 1
  if (record.failures >= MAX_FAILURES) {
    record.blockedUntil = now + BLOCK_MS
    record.failures = 0
  }
  attempts.set(key, record)
  return blockedFor(key, now)
}

/** A correct PIN clears the streak — the limit is on consecutive failures. */
export function recordSuccess(key: string): void {
  attempts.delete(key)
}

/** Test seam. */
export function resetRateLimit(): void {
  attempts.clear()
}
