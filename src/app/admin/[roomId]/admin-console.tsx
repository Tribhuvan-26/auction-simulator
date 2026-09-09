'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, Octagon, ArrowRight, Check, X, Undo2, RotateCcw, Plus } from 'lucide-react'
import { BrutalButton } from '@/components/ui/brutal-button'
import { BidNumber } from '@/components/ui/bid-number'
import { PlayerAvatar } from '@/components/ui/player-avatar'
import { TeamChip } from '@/components/ui/team-chip'
import { SplitReveal } from '@/components/ui/split-reveal'
import { ShinyText } from '@/components/ui/shiny-text'
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
    <div className="bg-vinyl flex h-screen w-screen overflow-hidden bg-brand-charcoal text-white">
      {/* ── Stage ─────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden px-8 pb-28 pt-6">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="font-heading text-xs font-bold text-white/60 underline">
              All rooms
            </Link>
            <h1 className="font-heading text-2xl font-bold leading-tight">{snapshot.room.name}</h1>
            <p className="text-xs text-white/60">
              Round {snapshot.room.round} · {snapshot.queue.length} players left
            </p>
          </div>

          <span className="border-[3px] border-brand-charcoal bg-brand-yellow px-3 py-1 font-heading text-lg font-bold text-brand-charcoal">
            {snapshot.room.phase}
          </span>

          <div className="flex gap-2">
            <BrutalButton
              variant="blue"
              onClick={() => run(() => advanceToNextLot(roomId))}
              className="flex items-center gap-2"
            >
              Load next player <ArrowRight size={16} aria-hidden />
            </BrutalButton>
            <BrutalButton
              variant="blue"
              onClick={() => run(() => setPhase(roomId, snapshot.room.phase === 'LIVE' ? 'PAUSED' : 'LIVE'))}
              className="flex items-center gap-2"
            >
              {snapshot.room.phase === 'LIVE' ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
              {snapshot.room.phase === 'LIVE' ? 'Pause' : 'Resume'}
            </BrutalButton>
            <BrutalButton variant="dark" onClick={() => setShowEndConfirm(true)} className="flex items-center gap-2">
              <Octagon size={16} aria-hidden /> End auction
            </BrutalButton>
          </div>
        </header>

        {lot ? (
          <div className="mt-6 flex min-h-0 flex-1 items-start gap-8 overflow-hidden">
            <PlayerAvatar
              name={lot.player.name}
              photoUrl={lot.player.photoUrl}
              className="h-48 w-48 shrink-0 text-3xl shadow-brutal"
            />
            <div className="min-w-0 flex-1">
              <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-yellow">
                {lot.player.setNumber} · base {formatMoney(lot.player.basePrice)}
              </p>
              <h2 className="mt-1 font-heading text-6xl font-bold leading-[0.95]">
                <SplitReveal text={lot.player.name} trigger={lot.id} />
              </h2>
              <p className="mt-2 font-heading text-xl text-white/70">
                <SplitReveal
                  text={`${lot.player.role.replace('_', '-')} · ${lot.player.nationality}${lot.player.isOverseas ? ' · overseas' : ''}`}
                  trigger={lot.id}
                  delay={0.18}
                  blur={false}
                />
              </p>

              <BidNumber
                value={lot.currentBid}
                className="mt-2 block font-heading text-[clamp(3.5rem,11vh,8rem)] font-black leading-none text-brand-yellow tabular-nums"
              />
              <p className="font-heading text-sm text-white/60">
                {leaderId
                  ? `Leading: ${snapshot.teams.find((t) => t.id === leaderId)?.name}`
                  : 'No bids yet'}
                {' · '}
                {closed ? lot.status : `next ${formatMoney(nextBid)}`}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border-4 border-brand-charcoal bg-black/40 p-8 backdrop-blur-md">
            <h2 className="font-heading text-3xl font-bold">No lot on the block</h2>
            <p className="mt-2 text-white/70">Load the next player to start bidding.</p>
          </div>
        )}

        {/* ── Bidding grid ────────────────────────────────────── */}
        <div className="mt-auto mb-6 grid w-full shrink-0 grid-cols-5 gap-3">
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
                animate={
                  leading
                    ? { scale: 1.05, opacity: 1, filter: 'grayscale(0)' }
                    : { scale: 1, opacity: blocked ? 0.3 : 0.5, filter: 'grayscale(1)' }
                }
                whileHover={blocked ? undefined : { scale: 1.02, opacity: 1, filter: 'grayscale(0)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                className={`rounded-xl border-2 p-1 text-left ${
                  leading
                    ? 'border-brand-blue shadow-[0_0_0_4px_rgba(32,116,213,0.35),0_18px_45px_-8px_rgba(32,116,213,0.9)]'
                    : 'border-brand-charcoal'
                } ${blocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className="pointer-events-none block">
                  <TeamChip
                    name={team.name}
                    shortCode={team.shortCode}
                    colorAccent={team.colorAccent}
                    className="w-full"
                  />
                </span>
                <span className="mt-1 block px-1 pb-1 font-heading text-[11px] tabular-nums text-white/70">
                  {formatMoney(team.purseRemaining)} · {team.squadCount}/{team.squadMax}
                </span>
              </motion.button>
            )
          })}
        </div>
      </section>

      {/* ── Command plate ───────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 z-30 flex h-24 w-[70vw] items-center gap-3 border-t-4 border-black bg-brand-charcoal px-8">
        <BrutalButton
          variant="yellow"
          disabled={!lot || closed || !leaderId}
          onClick={() => run(() => markSold(roomId))}
          className="flex items-center gap-2"
        >
          <Check size={16} aria-hidden />
          <ShinyText>SOLD</ShinyText>
        </BrutalButton>
        <BrutalButton
          variant="plain"
          disabled={!lot || closed}
          onClick={() => run(() => markUnsold(roomId))}
          className="flex items-center gap-2"
        >
          <X size={16} aria-hidden /> UNSOLD
        </BrutalButton>
        <BrutalButton
          variant="pink"
          disabled={!lot}
          onClick={() => run(() => undoLastBid(roomId))}
          className="flex items-center gap-2"
        >
          <Undo2 size={16} aria-hidden /> UNDO
        </BrutalButton>

        <span className="mx-2 h-10 w-px bg-white/20" aria-hidden />

        <BrutalButton variant="plain" disabled={!lot} onClick={() => run(() => controlTimer(roomId, 'start'))}>
          <Play size={16} aria-hidden />
        </BrutalButton>
        <BrutalButton variant="plain" disabled={!lot} onClick={() => run(() => controlTimer(roomId, 'pause'))}>
          <Pause size={16} aria-hidden />
        </BrutalButton>
        <BrutalButton variant="plain" disabled={!lot} onClick={() => run(() => controlTimer(roomId, 'reset'))}>
          <RotateCcw size={16} aria-hidden />
        </BrutalButton>
        <BrutalButton variant="plain" disabled={!lot} onClick={() => run(() => controlTimer(roomId, 'add10'))}>
          <Plus size={16} aria-hidden /> 10s
        </BrutalButton>
        <span className="font-heading text-sm tabular-nums text-white/70">{lot?.timerSeconds ?? 0}s</span>

        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const team = snapshot.teams.find((t) => t.id === effectiveJumpTeamId)
            if (team) bidFor(team, Number(jumpBid))
          }}
        >
          <label htmlFor="jump-bid" className="font-heading text-xs text-white/60">
            Jump bid
          </label>
          <select
            id="jump-team"
            aria-label="Jump bid team"
            value={effectiveJumpTeamId}
            onChange={(e) => setJumpTeamId(e.target.value)}
            className="border-[3px] border-brand-charcoal bg-white px-2 py-1 text-sm text-brand-charcoal"
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
            className="w-24 border-[3px] border-brand-charcoal bg-white px-2 py-1 text-center font-heading tabular-nums text-brand-charcoal"
          />
          <BrutalButton type="submit" variant="blue" disabled={!lot || closed || !jumpBid}>
            Bid
          </BrutalButton>
        </form>
      </div>

      {error && (
        <p
          role="alert"
          className="fixed bottom-28 left-8 z-30 rounded-xl border-[3px] border-brand-charcoal bg-brand-pink px-3 py-2 font-heading text-sm font-bold"
        >
          {error}
        </p>
      )}

      {/* ── Ledger ──────────────────────────────────────────────── */}
      <aside className="flex w-[30vw] shrink-0 flex-col border-l-4 border-brand-charcoal bg-black/60">
        <div className="flex min-h-0 flex-1 flex-col border-b-4 border-brand-charcoal p-4">
          <h2 className="font-heading text-lg font-bold">Bid log</h2>
          <p className="text-xs text-white/50">Newest first · Z pops the last entry</p>
          <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            <AnimatePresence initial={false}>
              {[...(lot?.bidHistory ?? [])].reverse().map((bid) => (
                <motion.li
                  key={`${bid.teamId}-${bid.timestamp}`}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="flex items-baseline justify-between gap-2 rounded-lg border-2 border-brand-charcoal bg-black/40 px-3 py-2 backdrop-blur-md"
                >
                  <span className="truncate font-heading text-sm">{bid.teamName}</span>
                  <span className="font-heading tabular-nums text-brand-yellow">{formatMoney(bid.amount)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
            {!lot?.bidHistory.length && <li className="text-sm text-white/50">No bids on this lot yet.</li>}
          </ul>
        </div>

        <div className="flex min-h-0 flex-[1.2] flex-col p-4">
          <h2 className="font-heading text-lg font-bold">Purse matrix</h2>
          <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
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
            className="fixed inset-0 z-40 flex items-center justify-center bg-brand-charcoal/80 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="max-w-sm rounded-2xl border-4 border-brand-charcoal bg-black/60 p-6 backdrop-blur-md"
            >
              <h2 className="font-heading text-xl font-bold">Are you sure?</h2>
              <p className="mt-1 text-white/70">
                Ending the auction closes the room for every team. Unsold players stay unsold.
              </p>
              <div className="mt-4 flex gap-2">
                <BrutalButton
                  variant="pink"
                  onClick={async () => {
                    await run(() => setPhase(roomId, 'COMPLETED'))
                    setShowEndConfirm(false)
                  }}
                >
                  End auction
                </BrutalButton>
                <BrutalButton onClick={() => setShowEndConfirm(false)}>Cancel</BrutalButton>
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

  const percent = Math.max(0, Math.round((team.purseRemaining / team.purseTotal) * 100))

  return (
    <motion.li
      data-testid={`purse-${team.shortCode}`}
      animate={{ backgroundColor: hit ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0)' }}
      transition={{ duration: 0.35 }}
      className={`rounded-lg border-2 px-2 py-1 ${leading ? 'border-brand-blue' : 'border-transparent'}`}
      style={{ borderLeftColor: team.colorAccent, borderLeftWidth: 6 }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-heading text-sm">{team.shortCode}</span>
        <span className="font-heading text-sm tabular-nums">{formatMoney(team.purseRemaining)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-white/15">
        <div className="h-full rounded-full bg-brand-blue" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[10px] text-white/50">
        {team.squadCount}/{team.squadMax} squad · {team.overseasSlotsUsed}/{team.overseasSlotsMax} overseas
      </p>
    </motion.li>
  )
}
