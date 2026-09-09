'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Gavel, TriangleAlert } from 'lucide-react'
import { BidNumber } from '@/components/ui/bid-number'
import { PlayerAvatar } from '@/components/ui/player-avatar'
import { bidRejectionReason, getNextBidAmount } from '@/lib/bid-rules'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { formatMoney } from '@/lib/money'
import { getPublicSnapshot, placeBid, type PublicSnapshot } from '@/app/admin/[roomId]/actions'

/** Ring colour per role, so a squad reads as a shape at a glance. */
const ROLE_RING: Record<string, string> = {
  BATTER: '#3b82f6',
  BOWLER: '#22c55e',
  ALL_ROUNDER: '#a855f7',
  WICKET_KEEPER: '#f59e0b',
}

type PaddleState = 'idle' | 'active' | 'winning' | 'outbid'

export function TeamConsole({
  roomId,
  teamId,
  initialSnapshot,
}: {
  roomId: string
  teamId: string
  initialSnapshot: PublicSnapshot
}) {
  const [outbid, setOutbid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const leaderRef = useRef(initialSnapshot.currentLot?.currentBiddingTeamId ?? null)
  const outbidTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { snapshot } = useLiveSnapshot(roomId, initialSnapshot, getPublicSnapshot, (event) => {
    if (event.type !== 'BID') return
    // Only a team that was actually holding the lot can be outbid by this bid.
    const weWereLeading = leaderRef.current === teamId
    const weLead = event.teamId === teamId
    if (weLead) {
      setOutbid(false)
      return
    }
    if (!weWereLeading) return
    setOutbid(true)
    clearTimeout(outbidTimer.current)
    outbidTimer.current = setTimeout(() => setOutbid(false), 6000)
  })

  const team = snapshot.teams.find((t) => t.id === teamId)!
  const lot = snapshot.currentLot
  const closed = lot?.status === 'SOLD' || lot?.status === 'UNSOLD'
  const leading = lot?.currentBiddingTeamId === teamId

  const nextBid = lot
    ? lot.status === 'BIDDING'
      ? getNextBidAmount(lot.currentBid, lot.player.basePrice)
      : lot.currentBid
    : 0

  const rejection = lot && !closed ? bidRejectionReason(team, lot, nextBid) : 'Waiting for the auctioneer'
  const canBid = !rejection && !leading && !pending

  const paddle: PaddleState = !lot || closed || rejection ? 'idle' : leading ? 'winning' : outbid ? 'outbid' : 'active'

  useEffect(() => {
    leaderRef.current = lot?.currentBiddingTeamId ?? null
  }, [lot?.currentBiddingTeamId])

  useEffect(() => () => clearTimeout(outbidTimer.current), [])

  async function raisePaddle() {
    if (!canBid || !lot) return
    setPending(true)
    setError(null)
    try {
      await placeBid(roomId, teamId, nextBid)
      setOutbid(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bid rejected')
    } finally {
      setPending(false)
    }
  }

  // Spacebar is the paddle. Suppressed while a control has focus so a keyboard
  // user pressing space on a button doesn't bid twice.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== ' ') return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return
      e.preventDefault()
      raisePaddle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const squadSlots = Array.from({ length: team.squadMax }, (_, i) => team.squad[i] ?? null)

  return (
    <div
      className="font-body flex h-screen w-screen flex-col overflow-hidden bg-[#0a0f18] text-slate-200"
      style={{ ['--team-accent' as string]: team.colorAccent }}
    >
      {/* Roster header */}
      <header className="z-50 flex h-20 w-full shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-10 backdrop-blur-md">
        <h1
          className="font-heading border-b-4 pb-1 text-2xl font-black text-white"
          style={{ borderColor: team.colorAccent, boxShadow: `0 6px 18px -6px ${team.colorAccent}` }}
        >
          {team.name}
        </h1>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Purse remaining</p>
            <p className="font-heading text-3xl font-black leading-none tabular-nums text-white">
              {formatMoney(team.purseRemaining)}
            </p>
          </div>
          <span className="font-heading rounded-full bg-white/10 px-4 py-1 text-sm tabular-nums text-slate-300">
            Squad {team.squadCount}/{team.squadMax}
          </span>
          <span className="font-heading rounded-full bg-white/10 px-4 py-1 text-sm tabular-nums text-slate-300">
            Overseas {team.overseasSlotsUsed}/{team.overseasSlotsMax}
          </span>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* The team's own colour bleeding into the room, kept faint. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            background: `radial-gradient(circle at top right, ${team.colorAccent} 0%, transparent 40%)`,
          }}
        />

        {/* ── Paddle (50%) ──────────────────────────────────── */}
        <section className="relative flex h-full w-1/2 flex-col justify-center gap-6 p-10">
          {lot ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-lg">
              <PlayerAvatar
                name={lot.player.name}
                photoUrl={lot.player.photoUrl}
                className="mx-auto h-40 w-40 border border-white/15 text-3xl"
              />
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-yellow-500">
                {lot.player.setNumber} • BASE {formatMoney(lot.player.basePrice)}
              </p>
              <h2 className="font-heading mt-1 text-5xl font-black tracking-tight text-white">{lot.player.name}</h2>
              <p className="mt-1 text-lg text-slate-400">
                {lot.player.role.replace('_', '-')} • {lot.player.isOverseas ? 'Overseas' : lot.player.nationality}
              </p>
              <BidNumber
                value={lot.currentBid}
                className="font-heading mt-4 block text-7xl font-black leading-none tabular-nums text-[#facc15]"
              />
              <p className="mt-1 text-sm text-slate-500">
                {closed
                  ? lot.status
                  : leading
                    ? 'You hold this lot'
                    : lot.currentBiddingTeamId
                      ? `Held by ${snapshot.teams.find((t) => t.id === lot.currentBiddingTeamId)?.name}`
                      : 'No bids yet'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-lg">
              <h2 className="font-heading text-4xl font-black text-white">Between lots</h2>
              <p className="mt-2 text-slate-400">The auctioneer is loading the next player. Sit tight.</p>
            </div>
          )}

          <PaddleButton state={paddle} amount={nextBid} onClick={raisePaddle} hint={rejection} />

          {error && (
            <p role="alert" className="flex items-center justify-center gap-2 text-sm font-bold text-rose-400">
              <TriangleAlert size={14} aria-hidden /> {error}
            </p>
          )}
        </section>

        {/* ── Squad matrix (50%) ────────────────────────────── */}
        <section className="relative flex h-full w-1/2 flex-col border-l border-white/10 bg-black/20 p-10">
          <div className="flex shrink-0 items-baseline justify-between">
            <h2 className="font-heading text-xs font-bold uppercase tracking-widest text-slate-500">Squad matrix</h2>
            <span className="text-xs tabular-nums text-slate-600">
              {team.squadCount} signed • {team.squadMax - team.squadCount} slots open
            </span>
          </div>

          <div className="scrollbar-thin-dark mt-6 grid min-h-0 flex-1 grid-cols-5 content-start gap-4 overflow-y-auto pr-2">
            {squadSlots.map((player, i) =>
              player ? (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  className="flex flex-col items-center gap-1"
                  title={`${player.name} — ${formatMoney(player.price)}`}
                >
                  <PlayerAvatar
                    name={player.name}
                    photoUrl={player.photoUrl}
                    className="aspect-square w-full border-2 text-xs"
                    style={{
                      borderColor: ROLE_RING[player.role] ?? '#64748b',
                      boxShadow: `0 0 14px -2px ${ROLE_RING[player.role] ?? '#64748b'}`,
                    }}
                  />
                  <span className="w-full truncate text-center text-[10px] text-slate-400">{player.name}</span>
                  <span className="text-[10px] tabular-nums text-slate-600">{formatMoney(player.price)}</span>
                </motion.div>
              ) : (
                <div
                  key={`empty-${i}`}
                  className="flex aspect-square items-center justify-center rounded-full border-2 border-[#1e293b] text-xs text-slate-700"
                >
                  {i + 1}
                </div>
              )
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

const PADDLE_COPY: Record<PaddleState, string> = {
  idle: 'Waiting for Auctioneer',
  active: 'Raise Paddle',
  winning: 'You hold the bid',
  outbid: 'Outbid! Click to Counter',
}

const PADDLE_CLASS: Record<PaddleState, string> = {
  idle: 'bg-[#111318] text-slate-500 border border-white/5 cursor-not-allowed',
  active: 'bg-brand-blue text-white shadow-[0_0_40px_rgba(32,116,213,0.4)]',
  winning: 'bg-yellow-500 text-black pointer-events-none',
  outbid: 'anim-paddle-alarm bg-rose-600 text-white',
}

function PaddleButton({
  state,
  amount,
  onClick,
  hint,
}: {
  state: PaddleState
  amount: number
  onClick: () => void
  hint: string | null
}) {
  const live = state === 'active' || state === 'outbid'
  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={onClick}
        disabled={!live}
        className={`font-heading w-full rounded-2xl py-8 text-3xl font-black tracking-tight transition-colors ${PADDLE_CLASS[state]}`}
      >
        <span className="flex items-center justify-center gap-3">
          <Gavel size={26} aria-hidden />
          {PADDLE_COPY[state]}
          {live && <span className="tabular-nums">· {formatMoney(amount)}</span>}
        </span>
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">
        {live ? 'Press space to raise' : (hint ?? 'You hold the highest bid')}
      </p>
    </div>
  )
}
