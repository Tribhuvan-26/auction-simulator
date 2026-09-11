import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/clock'
import { formatMoney } from '@/lib/money'
import { SectionHeader } from '@/components/ui/brutal-card'
import { TeamCrest } from '@/components/ui/team-crest'

/**
 * The modules every Neo-Grid screen assembles itself from — palette reference,
 * player auction card, current status, bidding log, team bid tracker. One file
 * because they are one system: they share the plate geometry and only ever
 * change together.
 *
 * Geometry rules (locked by the design system): rectangular plates, 3px
 * charcoal borders, zero radius, hard offset shadows, no glass, no gradients.
 */

export const PLATE = 'border-[3px] border-brand-charcoal bg-brand-white'

/** A titled rectangular plate: solid charcoal header bar over white body. */
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
      <SectionHeader className="flex shrink-0 items-baseline justify-between gap-2">
        <span>{title}</span>
        {right}
      </SectionHeader>
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  )
}

const PALETTE = [
  { hex: '#2074D5', className: 'bg-brand-blue' },
  { hex: '#F9D47B', className: 'bg-brand-yellow' },
  { hex: '#EB547C', className: 'bg-brand-pink' },
  { hex: '#FFFFFF', className: 'bg-brand-white' },
  { hex: '#282228', className: 'bg-brand-charcoal' },
]

/**
 * The palette reference plate in the top-left of every screen. It is part of
 * the product's identity in the reference mockups — a control-room legend that
 * says "this is one machine" — not a debug artifact.
 */
export function PaletteReference({ className }: { className?: string }) {
  return (
    <NeoPanel title="Neo-Grid Palette Reference" className={className} bodyClassName="p-2">
      <ul className="flex gap-1.5">
        {PALETTE.map((c) => (
          <li key={c.hex} className="min-w-0 flex-1">
            <div className={cn('h-10 w-full border-[3px] border-brand-charcoal', c.className)} />
            <p className="mt-1 font-mono text-[9px] leading-none tracking-tight text-brand-charcoal/80">{c.hex}</p>
          </li>
        ))}
      </ul>
    </NeoPanel>
  )
}

/**
 * Simple geometric bars, per the spec's "no 3D, no glossy analytics" rule.
 * ponytail: each metric is scaled against a fixed career-scale cap rather than
 * a league percentile — the snapshot carries no cross-player distribution to
 * rank against. Swap the caps for real percentiles if that data ever lands.
 */
const STAT_CAPS: { key: string; label: string; cap: number; color: string }[] = [
  { key: 'matches', label: 'M', cap: 250, color: 'bg-brand-pink' },
  { key: 'runs', label: 'R', cap: 6000, color: 'bg-brand-yellow' },
  { key: 'wickets', label: 'W', cap: 200, color: 'bg-brand-blue' },
  { key: 'average', label: 'AVG', cap: 60, color: 'bg-brand-pink' },
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
      <p className="font-heading shrink-0 text-[10px] font-bold uppercase tracking-widest">Performance graph</p>
      {!hasData && (
        <p className="font-heading mt-1 shrink-0 text-[9px] font-bold uppercase tracking-widest text-brand-charcoal/45">
          No career data on file
        </p>
      )}
      <div className="mt-1.5 flex min-h-0 flex-1 items-end gap-1.5 border-b-[3px] border-brand-charcoal">
        {STAT_CAPS.map((s) => {
          const value = stats[s.key] ?? 0
          const percent = Math.max(4, Math.min(100, Math.round((value / s.cap) * 100)))
          return (
            <div key={s.key} className="flex min-w-0 flex-1 flex-col items-center justify-end">
              <div
                className={cn('w-full border-[3px] border-brand-charcoal border-b-0', s.color)}
                style={{ height: `${percent}%` }}
                title={`${s.label} ${value || '—'}`}
              />
            </div>
          )
        })}
      </div>
      <div className="flex shrink-0 gap-1.5">
        {STAT_CAPS.map((s) => (
          <span
            key={s.key}
            className="font-heading min-w-0 flex-1 text-center text-[9px] font-bold tabular-nums text-brand-charcoal/70"
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
 * The locked central player card: photo plate, blue name band, pink current
 * bid, four data cells, performance graph. Shared by all three screens so the
 * lot on the block looks identical to the auctioneer, the seat and the room.
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
    <section className={cn(PLATE, 'flex min-h-0 gap-0 border-[3px] p-3', className)}>
      <PhotoPlate name={player.name} photoUrl={player.photoUrl} className="mr-3 w-[34%] shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-[3px] border-brand-charcoal bg-brand-blue px-3 py-2 text-brand-white">
          <h2 className="font-heading truncate text-3xl font-black leading-none tracking-tight">{player.name}</h2>
          <p className="font-heading mt-1 truncate text-xs font-bold uppercase tracking-widest">
            {leaderShortCode ?? player.setNumber} • {player.role.replace('_', '-')}
          </p>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="shrink-0 border-[3px] border-brand-charcoal bg-brand-pink px-3 py-2">
              <p className="font-heading text-[10px] font-bold uppercase tracking-widest">Current bid</p>
              <p className="font-heading text-4xl font-black leading-none tabular-nums">{formatMoney(currentBid)}</p>
            </div>
            <dl className="mt-3 grid shrink-0 grid-cols-2 border-[3px] border-brand-charcoal">
              <Cell label="Team" value={leaderShortCode ?? 'Waiting for bid'} />
              <Cell label="Role" value={player.role.replace('_', '-')} border />
              <Cell label="Base" value={formatMoney(player.basePrice)} top />
              <Cell label={purseLabel} value={formatMoney(purseValue)} top border />
            </dl>
          </div>

          <div className={cn(PLATE, 'min-w-0 flex-1 p-2')}>
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

/**
 * Rectangular photo plate. Local rather than the round PlayerAvatar because
 * the design system's player region is a dedicated rectangle, and `cn` only
 * concatenates — that component's radius and shadow can't be overridden.
 */
function PhotoPlate({
  name,
  photoUrl,
  className,
}: {
  name: string
  photoUrl?: string | null
  className?: string
}) {
  const frame = cn('border-[3px] border-brand-charcoal bg-brand-blue', className)
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local/external player photos, no next/image domain config
      <img src={photoUrl} alt="" aria-hidden className={cn(frame, 'object-cover object-center')} />
    )
  }
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div className={cn(frame, 'font-heading flex items-center justify-center text-5xl font-black')} aria-hidden>
      {initials}
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
        top && 'border-t-[3px] border-brand-charcoal',
        border && 'border-l-[3px] border-brand-charcoal'
      )}
    >
      <dt className="font-heading text-[10px] font-bold uppercase tracking-widest text-brand-charcoal/70">
        {label}
      </dt>
      <dd className="font-heading text-base font-black leading-tight tabular-nums">{value}</dd>
    </div>
  )
}

/**
 * The pink live-state plate: lot, auction state, dominant countdown. Highest
 * visual priority on every screen.
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
    <NeoPanel title="Current Status" className={className} bodyClassName="bg-brand-pink px-4 py-2">
      <p className="font-heading text-lg font-black uppercase leading-none tracking-tight">
        {lotLabel}: {state}
      </p>
      {seconds !== null && (
        <p className="font-heading mt-1.5 text-4xl font-black leading-none tabular-nums">{formatClock(seconds)}</p>
      )}
    </NeoPanel>
  )
}

/** Stacked rectangular rows: team abbreviation left, bid amount right. */
export function BiddingLog({
  rows,
  className,
}: {
  rows: { key: string; label: string; amount: number }[]
  className?: string
}) {
  return (
    <NeoPanel title="Bidding Log" className={className} bodyClassName="overflow-hidden p-2">
      <ul className="scrollbar-thin-dark flex h-full flex-col gap-1.5 overflow-y-auto pr-1">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex shrink-0 items-center justify-between gap-2 border-[3px] border-brand-charcoal px-3 py-1.5"
          >
            <span className="font-heading truncate text-sm font-bold">[{row.label}]</span>
            <span className="font-heading shrink-0 text-sm font-black tabular-nums">{formatMoney(row.amount)}</span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="font-heading px-1 text-xs font-bold uppercase tracking-widest text-brand-charcoal/50">
            No bids on this lot yet
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
 * Equal rectangular team tiles. The seed carries no logo files, so the tile
 * wordmark on the team's accent stands in for one — swap in an <img> here the
 * day Team.logoUrl is populated.
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
    <NeoPanel title="Team Bid Tracker" className={className} bodyClassName="p-2">
      <ul className="grid h-full grid-cols-5 gap-2">
        {teams.map((team) => {
          const leading = team.id === leaderId
          const blocked = pickBlocked?.(team) ?? null
          const inner = (
            <>
              <div
                className="flex min-h-0 flex-1 items-center justify-center gap-1.5 border-b-[3px] border-brand-charcoal px-1"
                style={{ backgroundColor: team.colorAccent }}
              >
                <TeamCrest
                  shortCode={team.shortCode}
                  name={team.name}
                  colorAccent={team.colorAccent}
                  logoUrl={team.logoUrl}
                  mark
                  className="h-full max-h-full w-auto shrink-0"
                />
                <span className="font-heading text-lg font-black tracking-widest text-brand-white">
                  {team.shortCode}
                </span>
              </div>
              <div
                data-testid={`purse-${team.shortCode}`}
                className="flex shrink-0 items-baseline justify-between gap-1 px-1.5 py-1"
              >
                <span className="font-heading text-xs font-black tabular-nums">
                  {formatMoney(team.purseRemaining)}
                </span>
                <span className="font-heading text-[10px] font-bold tabular-nums text-brand-charcoal/60">
                  {team.squadCount}/{team.squadMax}
                </span>
              </div>
            </>
          )

          const frame = cn(
            'flex h-full min-h-0 flex-col overflow-hidden border-[3px] border-brand-charcoal bg-brand-white text-left',
            leading && 'shadow-brutal'
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
                  className={cn(frame, 'w-full', blocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}
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
