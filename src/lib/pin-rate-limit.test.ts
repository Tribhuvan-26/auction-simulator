import { describe, it, expect, beforeEach } from 'vitest'
import { blockedFor, recordFailure, recordSuccess, resetRateLimit } from './pin-rate-limit'

const KEY = '203.0.113.7'

describe('pin rate limit', () => {
  beforeEach(() => resetRateLimit())

  it('allows an unknown caller', () => {
    expect(blockedFor(KEY)).toBe(0)
  })

  it('allows nine wrong PINs, blocks on the tenth', () => {
    for (let i = 0; i < 9; i++) expect(recordFailure(KEY)).toBe(0)
    expect(recordFailure(KEY)).toBe(1)
    expect(blockedFor(KEY)).toBe(1)
  })

  it('lets the block lapse after a minute', () => {
    const now = Date.now()
    for (let i = 0; i < 10; i++) recordFailure(KEY, now)
    expect(blockedFor(KEY, now + 59_000)).toBe(1)
    expect(blockedFor(KEY, now + 60_000)).toBe(0)
  })

  it('counts consecutive failures only — a correct PIN clears the streak', () => {
    for (let i = 0; i < 9; i++) recordFailure(KEY)
    recordSuccess(KEY)
    for (let i = 0; i < 9; i++) expect(recordFailure(KEY)).toBe(0)
    expect(blockedFor(KEY)).toBe(0)
  })

  it('blocks one caller without touching another', () => {
    for (let i = 0; i < 10; i++) recordFailure(KEY)
    expect(blockedFor(KEY)).toBe(1)
    expect(blockedFor('198.51.100.4')).toBe(0)
  })
})
