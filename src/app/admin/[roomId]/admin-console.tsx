'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, Octagon, ArrowRight, Check, X, Undo2, RotateCcw, Plus } from 'lucide-react'
import { BidNumber } from '@/components/ui/bid-number'
import { PlayerAvatar } from '@/components/ui/player-avatar'
import { SplitReveal } from '@/components/ui/split-reveal'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { getNextBidAmount, bidRejectionReason } from '@/lib/bid-rules'
import { formatMoney } from '@/lib/money'
import {
  getAdminSnapshot,
  setPhase,
  markSold,
  markUnsold,
  undoLastBid,
  controlTimer,
  placeBid,
  advanceToNextLot,
  type AdminSnapshot,
} from './actions'

type Team = AdminSnapshot['teams'][number]

/** Small white rounded-square icon button — the timer transport controls. */
function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 min-w-10 items-center justify-center gap-1 rounded-md bg-white px-2 text-sm font-bold text-[#111318] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  )
}

export function AdminConsole({
  roomId,
  initialSnapshot,
}: {
  roomId: string
  initialSnapshot: AdminSnapshot
}) {
  const { snapshot, setSnapshot } = useLiveSnapshot(roomId, initialSnapshot, getAdminSnapshot)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jumpBid, setJumpBid] = useState('')
  const [jumpTeamId, setJumpTeamId] = useState('')

  const lot = snapshot.currentLot
  const effectiveJumpTeamId = jumpTeamId || snapshot.teams[0]?.id || ''
  const leaderId = lot?.currentBiddingTeamId ?? null
  const leader = snapshot.teams.find((t) => t.id === leaderId)
  const closed = lot?.status === 'SOLD' || lot?.status === 'UNSOLD'

  // The ladder allows exactly one amount; the server rejects anything else.
  const nextBid = lot
    ? lot.status === 'BIDDING'
      ? getNextBidAmount(lot.currentBid, lot.player.basePrice)
      : lot.currentBid
    : 0

  async function run(action: () => Promise<AdminSnapshot>) {
    setError(null)
    try {
      setSnapshot(await action())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rejected')
    }
  }

  async function bidFor(team: Team, amount = nextBid) {
    if (!lot || closed) return
    const reason = bidRejectionReason(team, lot, amount)
    if (reason) {
      setError(`${team.shortCode}: ${reason}`)
      return
    }
    await run(() => placeBid(roomId, team.id, amount))
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!snapshot.currentLot) return
      // The jump-bid box lives in the command bar; typing an amount there must
      // not fire SOLD on the "s" of a keystroke.
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.key === ' ') {
        e.preventDefault()
        run(() => controlTimer(roomId, snapshot.room.phase === 'PAUSED' ? 'start' : 'pause'))
      } else if (e.key.toLowerCase() === 's') {
        run(() => markSold(roomId))
      } else if (e.key.toLowerCase() === 'u') {
        run(() => markUnsold(roomId))
      } else if (e.key.toLowerCase() === 'z') {
        run(() => undoLastBid(roomId))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, snapshot])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1a1d24] text-slate-200">
      {/* ── Stage (70%) ───────────────────────────────────────── */}
      <section className="bg-vinyl relative flex min-w-0 flex-1 flex-col overflow-hidden pb-24">
        {/* Brand pools sit above the grooves, so the accents stay saturated
         * instead of being flattened by a scrim. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(32,116,213,0.30),transparent_45%),radial-gradient(circle_at_95%_95%,rgba(235,84,124,0.22),transparent_45%)]" />

        <div className="relative flex min-h-0 flex-1 flex-col px-8 pt-6">
          {/* Top nav */}
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                href="/"
                className="text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300"
              >
                All rooms
              </Link>
              <h1 className="text-2xl font-bold leading-tight text-white">{snapshot.room.name}</h1>
              <p className="text-sm text-slate-400">
                Round {snapshot.room.round} • {snapshot.queue.length} players left
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-md bg-brand-yellow px-3 py-1.5 text-sm font-black tracking-wide text-black">
                {snapshot.room.phase}
              </span>
              <button
                type="button"
                onClick={() => run(() => advanceToNextLot(roomId))}
                className="flex items-center gap-2 rounded-full bg-brand-blue px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500"
              >
                Load next player <ArrowRight size={15} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => run(() => setPhase(roomId, snapshot.room.phase === 'LIVE' ? 'PAUSED' : 'LIVE'))}
                className="flex items-center gap-2 rounded-full border border-brand-blue px-5 py-2 text-sm font-bold text-brand-blue transition-colors hover:bg-brand-blue/10"
              >
                {snapshot.room.phase === 'LIVE' ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
                {snapshot.room.phase === 'LIVE' ? 'Pause' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={() => setShowEndConfirm(true)}
                className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-bold text-slate-300 transition-colors hover:border-white/40 hover:text-white"
              >
                <Octagon size={15} aria-hidden /> End auction
              </button>
            </div>
          </header>

          {/* Player profile */}
          {lot ? (
            <div className="mt-8 flex min-h-0 items-start gap-8">
              <PlayerAvatar
                name={lot.player.name}
                photoUrl={lot.player.photoUrl}
                className="h-48 w-48 shrink-0 border border-white/15 text-4xl shadow-[inset_0_2px_24px_rgba(0,0,0,0.65)]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-yellow-500">
                  {lot.player.setNumber} • BASE {formatMoney(lot.player.basePrice)}
                </p>
                <h2 className="mt-1 text-6xl font-black tracking-tight text-white">
                  <SplitReveal text={lot.player.name} trigger={lot.id} />
                </h2>
                <p className="mt-1 text-lg text-slate-400">
                  {lot.player.role.replace('_', '-')} • {lot.player.nationality}
                  {lot.player.isOverseas ? ' • overseas' : ''}
                </p>

                <BidNumber
                  value={lot.currentBid}
                  className="mt-4 block text-[6rem] font-black leading-none tabular-nums text-brand-yellow drop-shadow-lg"
                />
                <p className="mt-1 text-sm text-slate-400">
                  {leader ? `Leading: ${leader.name}` : 'No bids yet'} •{' '}
                  {closed ? lot.status : `next ${formatMoney(nextBid)}`}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-8">
              <h2 className="text-3xl font-black text-white">No lot on the block</h2>
              <p className="mt-2 text-slate-400">Load the next player to start bidding.</p>
            </div>
          )}

          {/* Team grid */}
          <div className="mt-12 mb-6 grid w-full shrink-0 grid-cols-5 gap-3 px-4">
            {snapshot.teams.map((team) => {
              const leading = team.id === leaderId
              const blocked = lot && !closed ? bidRejectionReason(team, lot, nextBid) : 'No lot on the block'
              return (
                <motion.button
                  key={team.id}
                  type="button"
                  data-testid={`bid-${team.shortCode}`}
                  onClick={() => bidFor(team)}
                  disabled={!!blocked}
                  title={blocked ?? `Bid ${formatMoney(nextBid)} for ${team.name}`}
                  animate={{ scale: leading ? 1.05 : 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                  className={`rounded-xl p-3 text-left transition-all ${
                    leading
                      ? 'border-2 border-blue-500 bg-yellow-400 text-black shadow-[0_0_30px_rgba(32,116,213,0.5)]'
                      : 'border border-white/10 bg-white/5 text-slate-500 hover:border-white/25 hover:text-slate-300'
                  } ${blocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: leading ? '#000' : team.colorAccent, opacity: leading ? 1 : 0.55 }}
                    />
                    <span className="text-xs font-black tracking-wider">{team.shortCode}</span>
                  </span>
                  <span className="mt-1 block truncate text-sm font-bold">{team.name}</span>
                  <span className={`mt-1 block text-[11px] tabular-nums ${leading ? 'text-black/70' : 'text-slate-500'}`}>
                    {formatMoney(team.purseRemaining)} • {team.squadCount}/{team.squadMax}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Command bar ───────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 z-30 flex h-20 w-[70vw] items-center gap-4 border-t border-white/10 bg-[#111318] px-6">
        <button
          type="button"
          disabled={!lot || closed || !leaderId}
          onClick={() => run(() => markSold(roomId))}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-black tracking-wide text-slate-300 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Check size={16} aria-hidden /> SOLD
        </button>
        <button
          type="button"
          disabled={!lot || closed}
          onClick={() => run(() => markUnsold(roomId))}
          className="flex items-center gap-2 rounded-lg bg-slate-600 px-5 py-2.5 text-sm font-black tracking-wide text-white transition-colors hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <X size={16} aria-hidden /> UNSOLD
        </button>
        <button
          type="button"
          disabled={!lot}
          onClick={() => run(() => undoLastBid(roomId))}
          className="flex items-center gap-2 rounded-lg bg-[#e11d48] px-5 py-2.5 text-sm font-black tracking-wide text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Undo2 size={16} aria-hidden /> UNDO
        </button>

        <span className="mx-1 h-8 w-px bg-white/10" aria-hidden />

        <IconButton label="Start timer" disabled={!lot} onClick={() => run(() => controlTimer(roomId, 'start'))}>
          <Play size={15} aria-hidden />
        </IconButton>
        <IconButton label="Pause timer" disabled={!lot} onClick={() => run(() => controlTimer(roomId, 'pause'))}>
          <Pause size={15} aria-hidden />
        </IconButton>
        <IconButton label="Reset timer to 30s" disabled={!lot} onClick={() => run(() => controlTimer(roomId, 'reset'))}>
          <RotateCcw size={15} aria-hidden />
        </IconButton>
        <IconButton label="Add 10 seconds" disabled={!lot} onClick={() => run(() => controlTimer(roomId, 'add10'))}>
          <Plus size={13} aria-hidden /> 10s
        </IconButton>
        <span className="text-sm tabular-nums text-slate-400">{lot?.timerSeconds ?? 0}s</span>

        <form
          className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 p-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            const team = snapshot.teams.find((t) => t.id === effectiveJumpTeamId)
            if (team) bidFor(team, Number(jumpBid))
          }}
        >
          <label htmlFor="jump-bid" className="pl-1 text-xs uppercase tracking-widest text-slate-500">
            Jump bid
          </label>
          <select
            id="jump-team"
            aria-label="Jump bid team"
            value={effectiveJumpTeamId}
            onChange={(e) => setJumpTeamId(e.target.value)}
            className="rounded-md border border-white/10 bg-[#1a1d24] px-2 py-1.5 text-sm text-slate-200"
          >
            {snapshot.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortCode}
              </option>
            ))}
          </select>
          <input
            id="jump-bid"
            inputMode="numeric"
            placeholder={String(nextBid)}
            value={jumpBid}
            onChange={(e) => setJumpBid(e.target.value.replace(/\D/g, ''))}
            className="w-24 rounded-md border border-white/10 bg-[#1a1d24] px-2 py-1.5 text-center text-sm tabular-nums text-slate-200 placeholder:text-slate-600"
          />
          <button
            type="submit"
            disabled={!lot || closed || !jumpBid}
            className="rounded-md bg-brand-blue px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Bid
          </button>
        </form>
      </div>

      {error && (
        <p
          role="alert"
          className="fixed bottom-24 left-6 z-30 rounded-lg border border-rose-400/40 bg-[#e11d48] px-3 py-2 text-sm font-bold text-white"
        >
          {error}
        </p>
      )}

      {/* ── Ledger (30%) ──────────────────────────────────────── */}
      <aside className="flex w-[30vw] shrink-0 flex-col space-y-6 border-l border-white/10 bg-[#111318] p-4">
        <div className="flex min-h-0 flex-1 flex-col">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Bid log</h2>
          <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {[...(lot?.bidHistory ?? [])].reverse().map((bid) => (
                <motion.li
                  key={`${bid.teamId}-${bid.timestamp}`}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <span className="truncate text-sm font-bold text-white">{bid.teamName}</span>
                  <span className="shrink-0 text-sm font-black tabular-nums text-brand-yellow">
                    {formatMoney(bid.amount)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
            {!lot?.bidHistory.length && <li className="text-sm text-slate-500">No bids on this lot yet.</li>}
          </ul>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Purse matrix</h2>
          <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {snapshot.teams.map((team) => (
              <PurseRow key={team.id} team={team} leading={team.id === leaderId} />
            ))}
          </ul>
        </div>
      </aside>

      <AnimatePresence>
        {showEndConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="max-w-sm rounded-xl border border-white/10 bg-[#111318] p-6"
            >
              <h2 className="text-xl font-black text-white">Are you sure?</h2>
              <p className="mt-2 text-sm text-slate-400">
                Ending the auction closes the room for every team. Unsold players stay unsold.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    await run(() => setPhase(roomId, 'COMPLETED'))
                    setShowEndConfirm(false)
                  }}
                  className="rounded-lg bg-[#e11d48] px-4 py-2 text-sm font-bold text-white hover:bg-rose-500"
                >
                  End auction
                </button>
                <button
                  type="button"
                  onClick={() => setShowEndConfirm(false)}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * One team's budget. Flashes white the moment purseRemaining drops, so the
 * financial hit of a sale is visible without reading the number.
 */
function PurseRow({ team, leading }: { team: Team; leading: boolean }) {
  const previous = useRef(team.purseRemaining)
  const [hit, setHit] = useState(false)

  useEffect(() => {
    if (team.purseRemaining < previous.current) {
      setHit(true)
      const timer = setTimeout(() => setHit(false), 900)
      previous.current = team.purseRemaining
      return () => clearTimeout(timer)
    }
    previous.current = team.purseRemaining
  }, [team.purseRemaining])

  const percent = Math.max(0, Math.min(100, Math.round((team.purseRemaining / team.purseTotal) * 100)))

  return (
    <motion.li
      data-testid={`purse-${team.shortCode}`}
      animate={{ backgroundColor: hit ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0)' }}
      transition={{ duration: 0.35 }}
      className={`rounded-lg px-2 py-1.5 ${leading ? 'ring-1 ring-blue-500/60' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-white">{team.shortCode}</span>
        <span className="text-sm tabular-nums text-slate-300">{formatMoney(team.purseRemaining)}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800">
        <div
          className="h-1.5 rounded-full bg-blue-500 transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </motion.li>
  )
}
