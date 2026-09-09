import { describe, it, expect } from 'vitest'
import { getNextBidAmount } from './bid-rules'

// Amounts are whole lakhs: 100 = ₹1 Cr.
describe('getNextBidAmount', () => {
  it('opens at the base price while the ladder has not started', () => {
    expect(getNextBidAmount(0, 30)).toBe(30)
    expect(getNextBidAmount(29, 30)).toBe(30)
  })

  it('raises by 5 L under ₹1 Cr', () => {
    expect(getNextBidAmount(30, 30)).toBe(35)
    expect(getNextBidAmount(95, 30)).toBe(100)
  })

  it('raises by 10 L from ₹1 Cr to under ₹2 Cr', () => {
    expect(getNextBidAmount(100, 30)).toBe(110)
    expect(getNextBidAmount(190, 30)).toBe(200)
  })

  it('raises by 20 L from ₹2 Cr to under ₹5 Cr', () => {
    expect(getNextBidAmount(200, 30)).toBe(220)
    expect(getNextBidAmount(480, 30)).toBe(500)
  })

  it('raises by 25 L at ₹5 Cr and above', () => {
    expect(getNextBidAmount(500, 30)).toBe(525)
    expect(getNextBidAmount(2000, 30)).toBe(2025)
  })

  it('steps over a tier boundary without skipping it', () => {
    // 95 -> 100 -> 110: the 5 L tier lands exactly on ₹1 Cr, then 10 L applies.
    expect(getNextBidAmount(getNextBidAmount(95, 30), 30)).toBe(110)
  })
})
