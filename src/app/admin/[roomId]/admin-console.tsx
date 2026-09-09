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

/** Square transport control for the timer. */
function TimerButton({
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
      className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-slate-200 transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-25"
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
      // The jump-bid box lives in the command plate; typing an amount there
      // must not fire SOLD on the "s" of a keystroke.
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
    <div className="font-body flex h-screen w-screen overflow-hidden bg-[#0a0f18] text-slate-200">
      {/* ── Left pane (70%) ───────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(ellipse_at_left,_var(--tw-gradient-stops))] from-[#1e293b]/40 via-[#0f172a]/80 to-[#020617]">
        {/* Top navigation */}
        <div className="flex w-full shrink-0 items-start justify-between px-10 pt-8">
          <div>
            <Link
              href="/"
              className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300"
            >
              All rooms
            </Link>
            <h1 className="text-3xl font-semibold text-white">{snapshot.room.name}</h1>
            <p className="text-sm text-slate-500">
              Round {snapshot.room.round} • {snapshot.queue.length} players left
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-bold tracking-widest text-yellow-500">
              {snapshot.room.phase}
            </span>
            <button
              type="button"
              onClick={() => run(() => advanceToNextLot(roomId))}
              className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Load next player <ArrowRight size={15} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => run(() => setPhase(roomId, snapshot.room.phase === 'LIVE' ? 'PAUSED' : 'LIVE'))}
              className="flex items-center gap-2 rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
            >
              {snapshot.room.phase === 'LIVE' ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
              {snapshot.room.phase === 'LIVE' ? 'Pause' : 'Resume'}
            </button>
            <button
              type="button"
              onClick={() => setShowEndConfirm(true)}
              className="flex items-center gap-2 rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
            >
              <Octagon size={15} aria-hidden /> End auction
            </button>
          </div>
        </div>

        {/* Cinematic stage */}
        {lot ? (
          <div className="flex min-h-0 flex-1 items-center gap-10 overflow-hidden px-10 pt-8">
            <PlayerAvatar
              name={lot.player.name}
              photoUrl={lot.player.photoUrl}
              className="h-[240px] w-[240px] shrink-0 rounded-full border border-white/10 text-5xl shadow-[0_0_40px_rgba(0,0,0,0.5)]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500">
                {lot.player.setNumber} • BASE {formatMoney(lot.player.basePrice)}
              </p>
              <h2 className="mt-2 text-7xl font-black tracking-tighter text-white">
                <SplitReveal text={lot.player.name} trigger={lot.id} />
              </h2>
              <p className="mt-1 text-xl font-medium text-slate-400">
                {lot.player.role.replace('_', '-')} • {lot.player.nationality}
                {lot.player.isOverseas ? ' • overseas' : ''}
              </p>
              <BidNumber
                value={lot.currentBid}
                className="my-4 block text-[8rem] font-black leading-none tabular-nums text-[#facc15] drop-shadow-xl"
              />
              <p className="text-sm text-slate-500">
                {leader ? `Leading: ${leader.name}` : 'No bids yet'} •{' '}
                {closed ? lot.status : `next ${formatMoney(nextBid)}`}
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden px-10 pt-16">
            <h2 className="text-5xl font-black tracking-tighter text-white">No lot on the block</h2>
            <p className="mt-2 text-xl text-slate-500">Load the next player to start bidding.</p>
          </div>
        )}

        {/* Team grid */}
        <div className="mt-auto mb-10 grid shrink-0 grid-cols-5 gap-4 px-10">
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
                animate={{ scale: leading ? 1.02 : 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className={`flex h-24 flex-col justify-between rounded-xl p-4 text-left transition-transform ${
                  leading
                    ? 'border-none bg-[#facc15] text-black shadow-[0_0_30px_rgba(250,204,21,0.3)]'
                    : 'border border-white/5 bg-white/5 text-slate-500 hover:bg-white/10'
                } ${blocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 rounded-full ${leading ? 'bg-black/60' : 'bg-slate-700'}`}
                  />
                  <span className="text-xs font-bold tracking-widest">{team.shortCode}</span>
                </span>
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-xs ${leading ? 'text-black/60' : ''}`}>{team.name}</span>
                  <span className={`shrink-0 text-xs tabular-nums ${leading ? 'text-black' : 'text-slate-400'}`}>
                    {formatMoney(team.purseRemaining)} • {team.squadCount}/{team.squadMax}
                  </span>
                </span>
              </motion.button>
            )
          })}
        </div>

        {/* Command plate */}
        <div className="flex h-24 shrink-0 items-center justify-between border-t border-white/10 bg-[#05080f] px-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!lot || closed || !leaderId}
              onClick={() => run(() => markSold(roomId))}
              className="flex items-center gap-2 rounded-lg bg-white/5 px-6 py-3 text-sm font-bold tracking-wide text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Check size={16} aria-hidden /> SOLD
            </button>
            <button
              type="button"
              disabled={!lot || closed}
              onClick={() => run(() => markUnsold(roomId))}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-6 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <X size={16} aria-hidden /> UNSOLD
            </button>
            <button
              type="button"
              disabled={!lot}
              onClick={() => run(() => undoLastBid(roomId))}
              className="flex items-center gap-2 rounded-lg bg-rose-600 px-6 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Undo2 size={16} aria-hidden /> UNDO
            </button>
          </div>

          <div className="flex items-center gap-3">
            <TimerButton label="Start timer" disabled={!lot} onClick={() => run(() => controlTimer(roomId, 'start'))}>
              <Play size={16} aria-hidden />
            </TimerButton>
            <TimerButton label="Pause timer" disabled={!lot} onClick={() => run(() => controlTimer(roomId, 'pause'))}>
              <Pause size={16} aria-hidden />
            </TimerButton>
            <TimerButton
              label="Reset timer to 30s"
              disabled={!lot}
              onClick={() => run(() => controlTimer(roomId, 'reset'))}
            >
              <RotateCcw size={16} aria-hidden />
            </TimerButton>
            <TimerButton label="Add 10 seconds" disabled={!lot} onClick={() => run(() => controlTimer(roomId, 'add10'))}>
              <Plus size={16} aria-hidden />
            </TimerButton>
            <span className="ml-1 text-sm tabular-nums text-slate-500">{lot?.timerSeconds ?? 0}s</span>
          </div>

          <form
            className="flex flex-row items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const team = snapshot.teams.find((t) => t.id === effectiveJumpTeamId)
              if (team) bidFor(team, Number(jumpBid))
            }}
          >
            <label htmlFor="jump-bid" className="text-[10px] uppercase tracking-widest text-slate-600">
              Jump bid
            </label>
            <select
              id="jump-team"
              aria-label="Jump bid team"
              value={effectiveJumpTeamId}
              onChange={(e) => setJumpTeamId(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#020617] px-3 py-2.5 text-sm text-slate-200"
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
              className="w-24 rounded-lg border border-white/10 bg-[#020617] px-3 py-2.5 text-center text-sm tabular-nums text-slate-200 placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={!lot || closed || !jumpBid}
              className="rounded-lg bg-blue-600/70 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Bid
            </button>
          </form>
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="fixed bottom-28 left-10 z-30 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {error}
        </p>
      )}

      {/* ── Right ledger (30%) ────────────────────────────────── */}
      <aside className="flex h-full w-[30vw] shrink-0 flex-col border-l border-white/10 bg-[#020617]">
        <div className="flex min-h-0 flex-[4] flex-col px-6 pt-8">
          <h2 className="shrink-0 text-xs font-bold uppercase tracking-widest text-slate-500">Bid log</h2>
          <ul className="scrollbar-thin-dark mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-2">
            <AnimatePresence initial={false}>
              {[...(lot?.bidHistory ?? [])].reverse().map((bid) => (
                <motion.li
                  key={`${bid.teamId}-${bid.timestamp}`}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="flex shrink-0 items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/5 px-4 py-3"
                >
                  <span className="truncate text-sm font-semibold text-white">{bid.teamName}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-[#facc15]">
                    {formatMoney(bid.amount)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
            {!lot?.bidHistory.length && <li className="text-sm text-slate-600">No bids on this lot yet.</li>}
          </ul>
        </div>

        <div className="flex min-h-0 flex-[6] flex-col border-t border-white/10 px-6 pt-6 pb-8">
          <h2 className="shrink-0 text-xs font-bold uppercase tracking-widest text-slate-500">Purse matrix</h2>
          <ul className="scrollbar-thin-dark mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2">
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
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="max-w-sm rounded-xl border border-white/10 bg-[#05080f] p-6"
            >
              <h2 className="text-xl font-bold text-white">Are you sure?</h2>
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
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
                >
                  End auction
                </button>
                <button
                  type="button"
                  onClick={() => setShowEndConfirm(false)}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"
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
      animate={{ backgroundColor: hit ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0)' }}
      transition={{ duration: 0.35 }}
      className={`shrink-0 rounded-md px-1 py-1 ${leading ? 'ring-1 ring-[#facc15]/40' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-white">{team.shortCode}</span>
        <span className="text-sm font-semibold tabular-nums text-white">{formatMoney(team.purseRemaining)}</span>
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-white/10">
        <div
          className="h-1 rounded-full bg-blue-500 transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </motion.li>
  )
}
