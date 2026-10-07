import { describe, it, expect, vi, beforeEach } from 'vitest'

const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined) }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { team: { findUnique: vi.fn(async () => ({ passcode: '4821' })) } },
}))

import { hasTeamAccess, seatToken, teamCookieName } from './team-auth'

describe('seat cookies', () => {
  beforeEach(() => {
    jar.clear()
    process.env.AUTH_SECRET = 'test-secret'
  })

  it('never stores the PIN itself', () => {
    expect(seatToken('team', 't1', '4821')).not.toContain('4821')
  })

  it('binds the token to the seat kind, id and PIN', () => {
    const base = seatToken('team', 't1', '4821')
    expect(seatToken('admin', 't1', '4821')).not.toBe(base)
    expect(seatToken('team', 't2', '4821')).not.toBe(base)
    expect(seatToken('team', 't1', '4822')).not.toBe(base)
  })

  it('accepts the signed token and rejects the raw PIN', async () => {
    jar.set(teamCookieName('t1'), '4821')
    expect(await hasTeamAccess('t1')).toBe(false)
    jar.set(teamCookieName('t1'), seatToken('team', 't1', '4821'))
    expect(await hasTeamAccess('t1')).toBe(true)
  })
})
