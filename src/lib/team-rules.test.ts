import { describe, it, expect } from 'vitest'
import { squadProblems, squadRejectionReason, standings, type SquadPlayer } from './team-rules'

const p = (role: string, over: Partial<SquadPlayer> = {}): SquadPlayer => ({
  name: `${role}-${Math.random()}`, role, isOverseas: false, uncapped: false, ...over,
})
const many = (n: number, role: string, over: Partial<SquadPlayer> = {}) => Array.from({ length: n }, () => p(role, over))

/** A legal XI: 4 batters (one uncapped), 1 keeper, 2 all-rounders, 4 bowlers. */
const legalXI = () => [
  ...many(3, 'BATTER'), p('BATTER', { uncapped: true }),
  p('WICKET_KEEPER'), ...many(2, 'ALL_ROUNDER'), ...many(4, 'BOWLER'),
]

describe('squadRejectionReason', () => {
  it('caps batters at 4 and keepers at 1', () => {
    expect(squadRejectionReason(many(4, 'BATTER'), p('BATTER'))).toBe('Batter slots full')
    expect(squadRejectionReason([p('WICKET_KEEPER')], p('WICKET_KEEPER'))).toBe('Wicket keeper slots full')
  })

  it('takes the 12th player only as an all-rounder or a bowler', () => {
    expect(squadRejectionReason(legalXI(), p('ALL_ROUNDER'))).toBeNull()
    expect(squadRejectionReason(legalXI(), p('BOWLER'))).toBeNull()
    expect(squadRejectionReason(legalXI(), p('BATTER'))).toBe('Batter slots full')
  })

  it('stops at 12', () => {
    expect(squadRejectionReason([...legalXI(), p('BOWLER')], p('ALL_ROUNDER'))).toBe('Squad full')
  })

  it('caps overseas players at 4', () => {
    expect(squadRejectionReason(many(4, 'BOWLER', { isOverseas: true }), p('BATTER', { isOverseas: true }))).toBe('Overseas slots full')
  })

  it('keeps enough slots for the roles still missing', () => {
    // 5 bowlers + 3 all-rounders = 8 slots; 4 left must go to 4 batters... and a keeper is still needed.
    const squad = [...many(5, 'BOWLER'), ...many(2, 'ALL_ROUNDER'), ...many(3, 'BATTER', { uncapped: true })]
    expect(squadRejectionReason(squad, p('ALL_ROUNDER'))).toBe('Slot needed for a missing role')
  })

  it('saves the last slot for an uncapped player', () => {
    const capped = legalXI().map((x) => ({ ...x, uncapped: false }))
    expect(squadRejectionReason(capped, p('BOWLER'))).toBe('Last slot must be an uncapped player')
    expect(squadRejectionReason(capped, p('BOWLER', { uncapped: true }))).toBeNull()
  })
})

describe('squadProblems', () => {
  it('is empty for a legal XI', () => {
    expect(squadProblems(legalXI())).toEqual([])
  })

  it('names what is missing', () => {
    expect(squadProblems(many(4, 'BATTER'))).toEqual(['1 more wicket keeper', '2 more all-rounders', '4 more bowlers', 'no uncapped player'])
  })
})

describe('standings', () => {
  it('scores 80% average rating + 20% purse left, eligible teams first', () => {
    const rated = (name: string, role: string, uncapped = false) => ({ name, role, isOverseas: false, uncapped })
    // Ratings from the sheet: Kohli 98.
    const legal = [...legalXI().slice(1), rated('Virat Kohli', 'BATTER')]
    const rows = standings([
      { id: 'short', purseRemaining: 10_000, purseTotal: 10_000, squad: [rated('Virat Kohli', 'BATTER')] },
      { id: 'legal', purseRemaining: 5_000, purseTotal: 10_000, squad: legal },
    ])
    expect(rows.map((r) => r.teamId)).toEqual(['legal', 'short'])
    expect(rows[1]).toMatchObject({ eligible: false, avgRating: 98, walletPct: 100, score: 0.8 * 98 + 20 })
    expect(rows[0].walletPct).toBe(50)
  })
})
