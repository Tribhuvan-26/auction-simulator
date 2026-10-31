import { describe, it, expect } from 'vitest'
import { activeBidders, bidRejectionReason, getNextBidAmount, type BidLot, type BidTeam } from './bid-rules'

// Amounts are whole lakhs: 100 = ₹1 Cr.
describe('getNextBidAmount', () => {
  it('opens at the base price while the ladder has not started', () => {
    expect(getNextBidAmount(0, 50)).toBe(50)
    expect(getNextBidAmount(49, 50)).toBe(50)
  })

  it('raises by 10 L up to ₹2 Cr', () => {
    expect(getNextBidAmount(50, 50)).toBe(60)
    expect(getNextBidAmount(190, 50)).toBe(200)
  })

  it('raises by 20 L from ₹2 Cr to under ₹5 Cr', () => {
    expect(getNextBidAmount(200, 50)).toBe(220)
    expect(getNextBidAmount(480, 50)).toBe(500)
  })

  it('raises by 50 L from ₹5 Cr to under ₹10 Cr', () => {
    expect(getNextBidAmount(500, 50)).toBe(550)
    expect(getNextBidAmount(950, 50)).toBe(1000)
  })

  it('raises by 1 Cr at ₹10 Cr and above', () => {
    expect(getNextBidAmount(1000, 50)).toBe(1100)
    expect(getNextBidAmount(2000, 50)).toBe(2100)
  })
})

describe('activeBidders', () => {
  it('lists each bidding team once, in the order they came in, minus drops', () => {
    expect(activeBidders(['a', 'b', 'a', 'c'], ['b'])).toEqual(['a', 'c'])
  })
})

describe('bidRejectionReason', () => {
  const team = (over: Partial<BidTeam> = {}): BidTeam => ({
    id: 't1', purseRemaining: 10_000, squadMax: 12, overseasSlotsMax: 4, squad: [], ...over,
  })
  const lot = (over: Partial<BidLot> = {}): BidLot => ({
    currentBid: 100, status: 'BIDDING', activeBidders: [], droppedTeamIds: [],
    player: { role: 'BATTER', isOverseas: false, setNumber: 'Capped Players' }, ...over,
  })

  it('lets a team in while fewer than two are bidding', () => {
    expect(bidRejectionReason(team(), lot({ activeBidders: ['t2'] }), 110)).toBeNull()
  })

  it('keeps a third team out of a two-team contest', () => {
    expect(bidRejectionReason(team(), lot({ activeBidders: ['t2', 't3'] }), 110)).toMatch(/two teams/i)
    expect(bidRejectionReason(team({ id: 't3' }), lot({ activeBidders: ['t2', 't3'] }), 110)).toBeNull()
  })

  it('keeps a team that dropped out', () => {
    expect(bidRejectionReason(team(), lot({ droppedTeamIds: ['t1'] }), 110)).toMatch(/dropped/i)
  })

  it('stops a team whose purse is exhausted', () => {
    expect(bidRejectionReason(team({ purseRemaining: 100 }), lot(), 110)).toBe('Purse insufficient')
  })

  it('applies the squad rules', () => {
    const batters = Array.from({ length: 4 }, (_, i) => ({ name: `B${i}`, role: 'BATTER', isOverseas: false, uncapped: false }))
    expect(bidRejectionReason(team({ squad: batters }), lot(), 110)).toBe('Batter slots full')
  })
})
