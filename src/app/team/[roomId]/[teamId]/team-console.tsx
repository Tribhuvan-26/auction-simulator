'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Gavel, TriangleAlert } from 'lucide-react'
import { BidNumber } from '@/components/ui/bid-number'
import { PlayerAvatar } from '@/components/ui/player-avatar'
import { SectionHeader } from '@/components/ui/brutal-card'
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
    <div className="font-body flex h-screen w-screen flex-col overflow-hidden bg-grid-paper text-brand-charcoal">
      <h1 className="shrink-0 border-b-[3px] border-brand-charcoal px-8 pt-4 pb-2 font-heading text-3xl font-black uppercase leading-none tracking-tight md:text-4xl">
        Team Dashboard: {team.name}
      </h1>

      {/* Roster header */}
      <header className="z-50 flex h-16 w-full shrink-0 items-center justify-end gap-3 border-b-[3px] border-brand-charcoal bg-brand-white px-8">
        <div className="border-[3px] border-brand-charcoal bg-brand-pink px-4 py-1 text-right">
          <p className="font-heading text-[10px] font-bold uppercase tracking-widest">Purse remaining</p>
          <p className="font-heading text-xl font-black leading-none tabular-nums">
            {formatMoney(team.purseRemaining)}
          </p>
        </div>
        <span className="font-heading text-sm font-bold tabular-nums">
          Squad {team.squadCount}/{team.squadMax}
        </span>
        <span className="font-heading text-sm font-bold tabular-nums">
          Overseas {team.overseasSlotsUsed}/{team.overseasSlotsMax}
        </span>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* ── Paddle (50%) ──────────────────────────────────── */}
        <section className="relative flex h-full w-1/2 flex-col justify-center gap-4 p-8">
          {lot ? (
            <div className="border-[3px] border-brand-blue bg-brand-white p-6 text-center shadow-brutal">
              <PlayerAvatar
                name={lot.player.name}
                photoUrl={lot.player.photoUrl}
                className="mx-auto h-36 w-36 border-[3px] border-brand-charcoal text-3xl"
              />
              <p className="mt-4 font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand-charcoal/60">
                {lot.player.setNumber} • BASE {formatMoney(lot.player.basePrice)}
              </p>
              <h2 className="font-heading mt-1 text-4xl font-black tracking-tight">{lot.player.name}</h2>
              <p className="mt-1 text-lg text-brand-charcoal/70">
                {lot.player.role.replace('_', '-')} • {lot.player.isOverseas ? 'Overseas' : lot.player.nationality}
              </p>
              <BidNumber
                value={lot.currentBid}
                className="font-heading mt-4 inline-block border-[3px] border-brand-charcoal bg-brand-pink px-4 py-1 text-5xl font-black leading-none tabular-nums"
              />
              <p className="mt-2 text-sm text-brand-charcoal/60">
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
            <div className="border-[3px] border-brand-charcoal bg-brand-white p-10 text-center shadow-brutal">
              <h2 className="font-heading text-4xl font-black">Between lots</h2>
              <p className="mt-2 text-brand-charcoal/70">The auctioneer is loading the next player. Sit tight.</p>
            </div>
          )}

          <PaddleButton state={paddle} amount={nextBid} onClick={raisePaddle} hint={rejection} />

          {error && (
            <p role="alert" className="flex items-center justify-center gap-2 text-sm font-bold text-brand-pink">
              <TriangleAlert size={14} aria-hidden /> {error}
            </p>
          )}
        </section>

        {/* ── Squad matrix (50%) ────────────────────────────── */}
        <section className="relative flex h-full w-1/2 flex-col border-l-[3px] border-brand-charcoal bg-brand-white p-8">
          <SectionHeader className="-mx-8 -mt-8 mb-0 flex items-baseline justify-between">
            <span>Your Team Status</span>
            <span className="text-xs font-bold normal-case tabular-nums text-brand-white/70">
              {team.squadCount} signed • {team.squadMax - team.squadCount} slots open
            </span>
          </SectionHeader>

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
                    style={{ borderColor: ROLE_RING[player.role] ?? '#64748b' }}
                  />
                  <span className="w-full truncate text-center text-[10px] text-brand-charcoal/70">
                    {player.name}
                  </span>
                  <span className="text-[10px] tabular-nums text-brand-charcoal/50">{formatMoney(player.price)}</span>
                </motion.div>
              ) : (
                <div
                  key={`empty-${i}`}
                  className="flex aspect-square items-center justify-center border-2 border-brand-charcoal/30 text-xs text-brand-charcoal/40"
                >
                  {i + 1}
                </div>
              )
            )}
          </div>
        </section>
      </div>

      <div className="telemetry-footer shrink-0">// NEO-GRID POP SYSTEM TELEMETRY v2.1 // DEPLOYED //</div>
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
  idle: 'bg-brand-white/60 text-brand-charcoal/40 border-[3px] border-brand-charcoal cursor-not-allowed',
  active: 'bg-brand-blue text-brand-white border-[3px] border-brand-charcoal shadow-brutal',
  winning: 'bg-brand-yellow text-brand-charcoal border-[3px] border-brand-charcoal shadow-brutal pointer-events-none',
  outbid: 'anim-paddle-alarm bg-brand-pink text-brand-charcoal border-[3px] border-brand-charcoal',
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
