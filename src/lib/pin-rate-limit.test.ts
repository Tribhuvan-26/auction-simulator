import { describe, it, expect, beforeEach } from 'vitest'
import { blockedFor, recordFailure, recordSuccess, resetRateLimit } from './pin-rate-limit'

const IP = '203.0.113.7'

describe('pin rate limit', () => {
  beforeEach(() => resetRateLimit())

  it('allows an unknown caller', () => {
    expect(blockedFor(IP)).toBe(0)
  })

  it('allows four wrong PINs, blocks on the fifth', () => {
    for (let i = 0; i < 4; i++) expect(recordFailure(IP)).toBe(0)
    expect(recordFailure(IP)).toBe(15)
    expect(blockedFor(IP)).toBe(15)
  })

  it('lets the block lapse after 15 minutes', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) recordFailure(IP, now)
    expect(blockedFor(IP, now + 14 * 60_000)).toBe(1)
    expect(blockedFor(IP, now + 15 * 60_000)).toBe(0)
  })

  it('counts consecutive failures only — a correct PIN clears the streak', () => {
    for (let i = 0; i < 4; i++) recordFailure(IP)
    recordSuccess(IP)
    for (let i = 0; i < 4; i++) expect(recordFailure(IP)).toBe(0)
    expect(blockedFor(IP)).toBe(0)
  })

  it('blocks one caller without touching another', () => {
    for (let i = 0; i < 5; i++) recordFailure(IP)
    expect(blockedFor(IP)).toBe(15)
    expect(blockedFor('198.51.100.4')).toBe(0)
  })
})
