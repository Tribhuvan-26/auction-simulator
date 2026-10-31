import ratings from '@/data/player-ratings.json'

// The room's squad rules. A squad is 12: the playing XI is 4 batters, 1 keeper,
// 2 all-rounders and 4 bowlers, and the 12th is one more all-rounder or bowler.
export const SQUAD_SIZE = 12
export const OVERSEAS_MAX = 4
export const UNCAPPED_MIN = 1
/** 100 Cr, in whole lakhs. */
export const PURSE_TOTAL = 10_000

export type Role = 'BATTER' | 'WICKET_KEEPER' | 'ALL_ROUNDER' | 'BOWLER'

/** What the XI needs of each role. */
export const ROLE_MIN: Record<Role, number> = { BATTER: 4, WICKET_KEEPER: 1, ALL_ROUNDER: 2, BOWLER: 4 }
/** Batters and the keeper are capped at the XI's need; the 12th is an all-rounder or a bowler. */
export const ROLE_MAX: Record<Role, number> = { BATTER: 4, WICKET_KEEPER: 1, ALL_ROUNDER: 3, BOWLER: 5 }

export const ROLE_LABEL: Record<Role, string> = {
  BATTER: 'Batter',
  WICKET_KEEPER: 'Wicket keeper',
  ALL_ROUNDER: 'All-rounder',
  BOWLER: 'Bowler',
}

/** The order the auction calls roles in, and calls the unsold back in. */
export const ROLE_ORDER: Role[] = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']

export const UNCAPPED_SET = 'Uncapped Players'
export const isUncapped = (setNumber: string) => setNumber === UNCAPPED_SET
/** The player's auction category, as the auctioneer calls it. Overseas players are seeded as capped. */
export const categoryLabel = (p: { setNumber: string; isOverseas: boolean }) =>
  isUncapped(p.setNumber) ? 'UNCAPPED' : p.isOverseas ? 'OVERSEAS' : 'CAPPED'

export type SquadPlayer = { name: string; role: string; isOverseas: boolean; uncapped: boolean }

export function ratingFor(name: string): number | null {
  return (ratings as Record<string, number>)[name] ?? null
}

export function roleCounts(squad: Pick<SquadPlayer, 'role'>[]): Record<Role, number> {
  const counts: Record<Role, number> = { BATTER: 0, WICKET_KEEPER: 0, ALL_ROUNDER: 0, BOWLER: 0 }
  for (const p of squad) if (p.role in counts) counts[p.role as Role]++
  return counts
}

/**
 * Why this squad can't take this player, or null if it can. Checks the role
 * caps, the overseas cap, and that the squad can still be completed after
 * this buy: every slot left has to be enough for the roles still missing and
 * the uncapped player, or the team could never field a legal XI.
 */
export function squadRejectionReason(
  squad: SquadPlayer[],
  player: { role: string; isOverseas: boolean; uncapped: boolean },
  limits: { squadMax: number; overseasMax: number } = { squadMax: SQUAD_SIZE, overseasMax: OVERSEAS_MAX }
): string | null {
  if (squad.length >= limits.squadMax) return 'Squad full'
  const role = player.role as Role
  const counts = roleCounts(squad)
  if (counts[role] >= ROLE_MAX[role]) return `${ROLE_LABEL[role]} slots full`
  if (player.isOverseas && squad.filter((p) => p.isOverseas).length >= limits.overseasMax) return 'Overseas slots full'

  counts[role]++
  const slotsLeft = limits.squadMax - squad.length - 1
  const rolesMissing = (Object.keys(ROLE_MIN) as Role[]).reduce((n, r) => n + Math.max(0, ROLE_MIN[r] - counts[r]), 0)
  if (rolesMissing > slotsLeft) return 'Slot needed for a missing role'
  const hasUncapped = player.uncapped || squad.some((p) => p.uncapped)
  // An uncapped player can fill a missing role, so one free slot is enough.
  if (!hasUncapped && slotsLeft < UNCAPPED_MIN) return 'Last slot must be an uncapped player'
  return null
}

/** What stops this squad from fielding a legal XI, or [] if nothing does. */
export function squadProblems(squad: SquadPlayer[]): string[] {
  const counts = roleCounts(squad)
  const problems = (Object.keys(ROLE_MIN) as Role[])
    .filter((r) => counts[r] < ROLE_MIN[r])
    .map((r) => `${ROLE_MIN[r] - counts[r]} more ${ROLE_LABEL[r].toLowerCase()}${ROLE_MIN[r] - counts[r] > 1 ? 's' : ''}`)
  if (squad.filter((p) => p.uncapped).length < UNCAPPED_MIN) problems.push('no uncapped player')
  if (squad.filter((p) => p.isOverseas).length > OVERSEAS_MAX) problems.push('too many overseas')
  return problems
}

export type Standing = {
  teamId: string
  avgRating: number
  /** Purse left, as a percentage of the purse the team started with. */
  walletPct: number
  /** 80% average rating + 20% wallet. */
  score: number
  eligible: boolean
  problems: string[]
}

/**
 * The winning criteria: 80% the average rating of the players bought, 20% the
 * purse left. The best score wins even with an incomplete squad — `problems`
 * only says what the squad is missing.
 */
export function standings(
  teams: { id: string; purseRemaining: number; purseTotal: number; squad: SquadPlayer[] }[]
): Standing[] {
  return teams
    .map((t) => {
      const rated = t.squad.map((p) => ratingFor(p.name) ?? 0)
      const avgRating = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0
      const walletPct = t.purseTotal ? (t.purseRemaining / t.purseTotal) * 100 : 0
      const problems = squadProblems(t.squad)
      return {
        teamId: t.id,
        avgRating,
        walletPct,
        score: 0.8 * avgRating + 0.2 * walletPct,
        eligible: problems.length === 0,
        problems,
      }
    })
    .sort((a, b) => b.score - a.score)
}

/** Base price from the sheet's category and rating: uncapped 50 L; capped and overseas 1 Cr, or 2 Cr at 90+. */
export function basePriceFor(category: string, rating: number): number {
  if (category === 'Uncapped') return 50
  return rating >= 90 ? 200 : 100
}
