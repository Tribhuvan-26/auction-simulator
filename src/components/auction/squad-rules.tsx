'use client'

import { formatMoney } from '@/lib/money'
import { ROLE_MAX, ROLE_MIN, roleCounts, standings, UNCAPPED_MIN, type Role, type SquadPlayer } from '@/lib/team-rules'

const CHIPS: { role: Role; label: string }[] = [
  { role: 'BATTER', label: 'BAT' },
  { role: 'WICKET_KEEPER', label: 'WK' },
  { role: 'ALL_ROUNDER', label: 'AR' },
  { role: 'BOWLER', label: 'BOWL' },
]

/**
 * What the squad has against what the XI needs. Green once a role's minimum is
 * met, grey once it's full — a full role can't be bought any more.
 */
export function SquadNeeds({ squad }: { squad: SquadPlayer[] }) {
  const counts = roleCounts(squad)
  const uncapped = squad.filter((p) => p.uncapped).length
  const chip = (label: string, have: number, min: number, max: number) => {
    const full = have >= max
    const met = have >= min
    return (
      <div
        key={label}
        className={`flex flex-col items-center border px-2.5 py-1.5 ${
          full ? 'border-white/10 bg-white/5 text-white/40' : met ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300' : 'border-white/20 bg-[#17171A] text-white'
        }`}
      >
        <span className="font-mono text-[8px] font-black uppercase tracking-widest opacity-70">{label}</span>
        <span className="font-condensed text-lg font-black leading-none tabular-nums">
          {have}/{min === max ? min : max === Infinity ? `${min}+` : `${min}-${max}`}
        </span>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Squad needs">
      {CHIPS.map((c) => chip(c.label, counts[c.role], ROLE_MIN[c.role], ROLE_MAX[c.role]))}
      {chip('UNCAP', uncapped, UNCAPPED_MIN, Infinity)}
    </div>
  )
}

type StandingsTeam = {
  id: string
  name: string
  shortCode: string
  colorAccent: string
  purseRemaining: number
  purseTotal: number
  squad: SquadPlayer[]
}

/**
 * The winning criteria: 80% average rating of the players bought + 20% purse
 * left. A team that can't field a legal XI can't win — it's listed below the
 * eligible ones with what it's missing.
 */
export function StandingsTable({ teams }: { teams: StandingsTeam[] }) {
  const rows = standings(teams)
  const byId = new Map(teams.map((t) => [t.id, t]))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[28px_1fr_64px_64px_64px] gap-2 px-2 font-mono text-[9px] font-black uppercase tracking-widest text-white/50">
        <span>#</span>
        <span>TEAM</span>
        <span className="text-right">RATING</span>
        <span className="text-right">PURSE</span>
        <span className="text-right">SCORE</span>
      </div>
      {rows.map((r, i) => {
        const t = byId.get(r.teamId)!
        return (
          <div
            key={r.teamId}
            className={`grid grid-cols-[28px_1fr_64px_64px_64px] items-center gap-2 border px-2 py-2 ${
              r.eligible ? (i === 0 ? 'border-[#F9CD05] bg-[#F9CD05]/10' : 'border-white/10 bg-white/5') : 'border-white/5 bg-transparent opacity-60'
            }`}
          >
            <span className="font-condensed text-lg font-black text-white/70">{r.eligible ? i + 1 : '—'}</span>
            <div className="min-w-0">
              <p className="truncate font-condensed text-base font-black uppercase tracking-wide text-white">
                <span className="mr-2 inline-block h-2.5 w-2.5" style={{ background: t.colorAccent }} />
                {t.shortCode}
                <span className="ml-2 font-mono text-[10px] font-bold text-white/40">{t.squad.length} players</span>
              </p>
              {!r.eligible && (
                <p className="truncate font-mono text-[9px] font-bold uppercase text-rose-300">Can&apos;t win: {r.problems.join(', ')}</p>
              )}
            </div>
            <span className="text-right font-mono text-sm font-bold tabular-nums text-white">{r.avgRating.toFixed(1)}</span>
            <span className="text-right font-mono text-sm font-bold tabular-nums text-white/80" title={`${r.walletPct.toFixed(1)}% left`}>
              {formatMoney(t.purseRemaining)}
            </span>
            <span className="text-right font-condensed text-lg font-black tabular-nums text-brand-yellow">{r.score.toFixed(1)}</span>
          </div>
        )
      })}
      <p className="px-2 font-mono text-[9px] uppercase tracking-wider text-white/40">
        Score = 80% avg rating of players bought + 20% purse left (as % of purse)
      </p>
    </div>
  )
}
