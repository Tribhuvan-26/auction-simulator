import React from 'react'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/clock'
import { formatMoney } from '@/lib/money'
import { TeamCrest } from '@/components/ui/team-crest'

/**
 * Architectural Brutalist Plate: dark industrial surfaces, crisp technical borders,
 * hard offset shadows, restrained editorial color usage.
 */
export const PLATE = 'border border-white/12 bg-[#181818] text-brand-white shadow-brutal'

/** A titled rectangular plate: solid dark technical header bar over concrete charcoal body. */
export function NeoPanel({
  title,
  right,
  className,
  bodyClassName,
  children,
}: {
  title: string
  right?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn(PLATE, 'flex min-h-0 flex-col', className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#222222] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">
        <span>{title}</span>
        {right}
      </div>
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  )
}

const PALETTE = [
  { hex: '#2074D5', label: 'BLUE', className: 'bg-brand-blue' },
  { hex: '#F9D47B', label: 'YELLOW', className: 'bg-brand-yellow' },
  { hex: '#EB547C', label: 'PINK', className: 'bg-brand-pink' },
  { hex: '#FFFFFF', label: 'WHITE', className: 'bg-brand-white' },
  { hex: '#282828', label: 'CHARCOAL', className: 'bg-brand-charcoal' },
]

/**
 * Architectural Palette Reference: dark control-room technical swatch legend.
 */
export function PaletteReference({ className }: { className?: string }) {
  return (
    <NeoPanel title="Palette Reference" className={className} bodyClassName="p-2">
      <ul className="flex gap-1.5">
        {PALETTE.map((c) => (
          <li key={c.hex} className="min-w-0 flex-1">
            <div className={cn('h-8 w-full border border-white/20', c.className)} />
            <p className="mt-1 font-mono text-[8px] leading-none tracking-tight text-white/60">{c.hex}</p>
          </li>
        ))}
      </ul>
    </NeoPanel>
  )
}

/**
 * Architectural Performance Overview Bars
 */
const STAT_CAPS: { key: string; label: string; cap: number; color: string }[] = [
  { key: 'matches', label: 'M', cap: 250, color: 'bg-brand-blue' },
  { key: 'runs', label: 'RUNS', cap: 6000, color: 'bg-brand-yellow' },
  { key: 'wickets', label: 'W', cap: 200, color: 'bg-brand-pink' },
  { key: 'average', label: 'AVG', cap: 60, color: 'bg-brand-white' },
  { key: 'strikeRate', label: 'SR', cap: 200, color: 'bg-brand-blue' },
]

export function PerformanceGraph({
  stats,
  className,
}: {
  stats: Record<string, number | null>
  className?: string
}) {
  const hasData = STAT_CAPS.some((s) => (stats[s.key] ?? 0) > 0)

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <p className="font-mono shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
        Performance Overview
      </p>
      {!hasData && (
        <p className="font-mono mt-1 shrink-0 text-[9px] font-bold uppercase tracking-widest text-white/40">
          No career stats on record
        </p>
      )}
      <div className="mt-2 flex min-h-0 flex-1 items-end gap-2 border-b border-white/15 pb-1">
        {STAT_CAPS.map((s) => {
          const value = stats[s.key] ?? 0
          const percent = Math.max(5, Math.min(100, Math.round((value / s.cap) * 100)))
          return (
            <div key={s.key} className="flex min-w-0 flex-1 flex-col items-center justify-end h-full">
              <div
                className={cn('w-full border border-white/20 border-b-0 transition-all duration-300', s.color)}
                style={{ height: `${percent}%` }}
                title={`${s.label} ${value || '—'}`}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex shrink-0 gap-2">
        {STAT_CAPS.map((s) => (
          <span
            key={s.key}
            className="font-mono min-w-0 flex-1 text-center text-[9px] font-bold tabular-nums text-white/60"
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

type CardPlayer = {
  name: string
  role: string
  basePrice: number
  photoUrl: string | null
  nationality: string
  isOverseas: boolean
  setNumber: string
  matches: number
  runs: number | null
  wickets: number | null
  average: number | null
  strikeRate: number | null
}

/**
 * Architectural Player Card matching the visual reference:
 * - Photo with Yellow corner brackets
 * - Condensed typography
 * - Massive Yellow current bid card
 * - Performance overview bar graph
 */
export function PlayerAuctionCard({
  player,
  currentBid,
  leaderShortCode,
  purseLabel,
  purseValue,
  className,
}: {
  player: CardPlayer
  currentBid: number
  leaderShortCode: string | null
  purseLabel: string
  purseValue: number
  className?: string
}) {
  return (
    <section className={cn(PLATE, 'flex min-h-0 gap-0 p-3', className)}>
      {/* Player photo with architectural yellow corner brackets */}
      <div className="relative mr-3 w-[34%] shrink-0">
        <PhotoPlate name={player.name} photoUrl={player.photoUrl} className="h-full w-full" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Name banner */}
        <div className="shrink-0 border border-brand-blue/60 bg-brand-blue/20 px-3 py-2 text-brand-white">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-heading truncate text-3xl font-black uppercase tracking-tight text-white">
              {player.name}
            </h2>
            <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase text-brand-yellow">
              {player.setNumber}
            </span>
          </div>
          <p className="font-mono mt-0.5 truncate text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
            {player.role.replace('_', '-')} • {player.nationality} {player.isOverseas ? '• OVERSEAS' : ''}
          </p>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 gap-3">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            {/* Massive CURRENT BID highlight card (Reference 2 style) */}
            <div className="shrink-0 border border-brand-yellow bg-brand-yellow px-3.5 py-2.5 text-[#141414] shadow-brutal">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#141414]/80">
                  CURRENT BID
                </p>
                {leaderShortCode && (
                  <span className="font-mono text-[10px] font-black uppercase tracking-widest bg-[#141414] text-white px-2 py-0.5">
                    HIGHEST: {leaderShortCode}
                  </span>
                )}
              </div>
              <p className="font-heading text-4xl font-black leading-none tabular-nums text-[#141414] mt-1">
                {formatMoney(currentBid)}
              </p>
            </div>

            {/* Technical metrics cells */}
            <dl className="mt-2.5 grid shrink-0 grid-cols-2 border border-white/12 bg-[#1E1E1E]">
              <Cell label="Leader" value={leaderShortCode ?? '—'} />
              <Cell label="Role" value={player.role.replace('_', '-')} border />
              <Cell label="Base Price" value={formatMoney(player.basePrice)} top />
              <Cell label={purseLabel} value={formatMoney(purseValue)} top border />
            </dl>
          </div>

          <div className="min-w-0 flex-1 border border-white/10 bg-[#1A1A1A] p-2.5">
            <PerformanceGraph
              stats={{
                matches: player.matches,
                runs: player.runs,
                wickets: player.wickets,
                average: player.average,
                strikeRate: player.strikeRate,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function PhotoPlate({
  name,
  photoUrl,
  className,
}: {
  name: string
  photoUrl?: string | null
  className?: string
}) {
  return (
    <div className={cn('bracket-frame relative h-full w-full overflow-hidden border border-white/15 bg-[#1C1C1C]', className)}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          className="h-full w-full object-cover object-top filter contrast-[1.05]"
        />
      ) : (
        <div className="font-heading flex h-full w-full items-center justify-center text-4xl font-black text-white/30">
          {name
            .split(' ')
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase()}
        </div>
      )}
    </div>
  )
}

function Cell({
  label,
  value,
  top,
  border,
}: {
  label: string
  value: string
  top?: boolean
  border?: boolean
}) {
  return (
    <div
      className={cn(
        'px-3 py-1.5',
        top && 'border-t border-white/10',
        border && 'border-l border-white/10'
      )}
    >
      <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/50">
        {label}
      </dt>
      <dd className="font-heading text-base font-black leading-tight tabular-nums text-white">{value}</dd>
    </div>
  )
}

/**
 * Architectural Current Status readout with pink beacon/accent
 */
export function CurrentStatus({
  lotLabel,
  state,
  seconds,
  className,
}: {
  lotLabel: string
  state: string
  seconds: number | null
  className?: string
}) {
  return (
    <NeoPanel title="Current Status" className={className} bodyClassName="bg-[#202020] px-4 py-3 border-t border-white/10">
      <div className="flex items-center justify-between">
        <span className="font-heading text-base font-black uppercase tracking-wide text-white">
          {lotLabel}: <span className="text-brand-pink">{state}</span>
        </span>
        <span className="relative flex h-2.5 w-2.5">
          <span className="anim-beacon absolute inline-flex h-full w-full rounded-full bg-brand-pink opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-pink" />
        </span>
      </div>
      {seconds !== null && (
        <div className="mt-1 flex items-baseline justify-between">
          <p className="font-heading text-4xl font-black leading-none tabular-nums text-brand-yellow">
            {formatClock(seconds)}
          </p>
          <span className="font-mono text-[10px] tracking-[0.16em] text-white/50 uppercase">TIME REMAINING</span>
        </div>
      )}
    </NeoPanel>
  )
}

/** Architectural Bidding Log */
export function BiddingLog({
  rows,
  className,
}: {
  rows: { key: string; label: string; amount: number }[]
  className?: string
}) {
  return (
    <NeoPanel title="Bidding Log" className={className} bodyClassName="overflow-hidden p-2 bg-[#161616]">
      <ul className="scrollbar-thin-dark flex h-full flex-col gap-1.5 overflow-y-auto pr-1">
        {rows.map((row, idx) => (
          <li
            key={row.key}
            className="flex shrink-0 items-center justify-between gap-2 border border-white/10 bg-[#1F1F1F] px-3 py-1.5"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-white/40">#{rows.length - idx}</span>
              <span className="font-heading text-sm font-bold text-white">[{row.label}]</span>
            </div>
            <span className="font-heading shrink-0 text-sm font-black tabular-nums text-brand-yellow">
              {formatMoney(row.amount)}
            </span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="font-mono px-2 py-4 text-center text-xs font-bold uppercase tracking-widest text-white/40">
            No bids recorded
          </li>
        )}
      </ul>
    </NeoPanel>
  )
}

type TrackerTeam = {
  id: string
  name: string
  shortCode: string
  colorAccent: string
  logoUrl?: string | null
  purseRemaining: number
  squadCount: number
  squadMax: number
}

/**
 * Architectural Team Bid Tracker:
 * Retains all testids (`bid-${shortCode}`, `purse-${shortCode}`) and click handlers.
 */
export function TeamBidTracker({
  teams,
  leaderId,
  className,
  onPick,
  pickBlocked,
}: {
  teams: TrackerTeam[]
  leaderId?: string | null
  className?: string
  onPick?: (team: TrackerTeam) => void
  pickBlocked?: (team: TrackerTeam) => string | null
}) {
  return (
    <NeoPanel title="Team Bid Tracker" className={className} bodyClassName="p-2 bg-[#161616]">
      <ul className="grid h-full grid-cols-5 gap-2">
        {teams.map((team) => {
          const leading = team.id === leaderId
          const blocked = pickBlocked?.(team) ?? null
          const inner = (
            <>
              <div
                className="flex min-h-0 flex-1 items-center justify-center gap-1.5 border-b border-white/15 px-1.5 py-1"
                style={{ backgroundColor: team.colorAccent }}
              >
                <TeamCrest
                  shortCode={team.shortCode}
                  name={team.name}
                  colorAccent={team.colorAccent}
                  logoUrl={team.logoUrl}
                  mark
                  className="h-full max-h-full w-auto shrink-0 drop-shadow-md"
                />
                <span className="font-heading text-lg font-black tracking-wider text-white">
                  {team.shortCode}
                </span>
              </div>
              <div
                data-testid={`purse-${team.shortCode}`}
                className="flex shrink-0 items-baseline justify-between gap-1 bg-[#1C1C1C] px-2 py-1"
              >
                <span className="font-heading text-xs font-black tabular-nums text-white">
                  {formatMoney(team.purseRemaining)}
                </span>
                <span className="font-mono text-[9px] font-bold tabular-nums text-white/60">
                  {team.squadCount}/{team.squadMax}
                </span>
              </div>
            </>
          )

          const frame = cn(
            'flex h-full min-h-0 flex-col overflow-hidden border border-white/15 bg-[#181818] text-left transition-all duration-100',
            leading && 'ring-2 ring-brand-yellow shadow-glow-yellow'
          )

          return (
            <li key={team.id} className="min-h-0">
              {onPick ? (
                <button
                  type="button"
                  data-testid={`bid-${team.shortCode}`}
                  onClick={() => onPick(team)}
                  disabled={!!blocked}
                  title={blocked ?? `Bid for ${team.name}`}
                  className={cn(frame, 'w-full cursor-pointer hover:border-white/40', blocked && 'cursor-not-allowed opacity-40')}
                >
                  {inner}
                </button>
              ) : (
                <div className={frame} title={team.name}>
                  {inner}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </NeoPanel>
  )
}

