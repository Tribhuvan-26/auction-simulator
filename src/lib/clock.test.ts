import { describe, expect, it } from 'vitest'
import { formatClock } from './clock'

describe('formatClock', () => {
  it('pads to hours:minutes:seconds', () => {
    expect(formatClock(90)).toBe('00:01:30')
    expect(formatClock(30)).toBe('00:00:30')
    expect(formatClock(3661)).toBe('01:01:01')
  })

  it('floors a partial second and never goes negative', () => {
    expect(formatClock(9.7)).toBe('00:00:09')
    expect(formatClock(-5)).toBe('00:00:00')
  })
})
