'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Octagon, Pause, Play, RotateCcw, Undo2, X } from 'lucide-react'
import { BrutalButton } from '@/components/ui/brutal-button'
import {
  BiddingLog,
  NeoPanel,
  PlayerAuctionCard,
  TeamBidTracker,
} from '@/components/ui/neo-grid'
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
  forceBid,
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
  // A second bid fired before the first one's response lands would compute
  // its amount off the same stale currentBid — the server rejects it as
  // off-tier, which reads as "that team can't bid" when it's really just a
  // click that needs retrying. Lock the grid for the round trip instead.
  const [pending, setPending] = useState(false)

  const lot = snapshot.currentLot
  const effectiveJumpTeamId = jumpTeamId || snapshot.teams[0]?.id || ''
  const leaderId = lot?.currentBiddingTeamId ?? null
  const leader = snapshot.teams.find((t) => t.id === leaderId)
  const closed = lot?.status === 'SOLD' || lot?.status === 'UNSOLD'
  const paused = snapshot.room.phase === 'PAUSED'

  // The ladder allows exactly one amount; the server rejects anything else.
  const nextBid = lot
    ? lot.status === 'BIDDING'
      ? getNextBidAmount(lot.currentBid, lot.player.basePrice)
      : lot.currentBid
    : 0

  // Distinct teams that have bid on this lot, in the order they joined —
  // the tracker only highlights the current leader, so a second team just
  // sitting one rung back otherwise looks like it dropped out.
  const biddingTeamCodes = lot
    ? [...new Map(lot.bidHistory.map((b) => [b.teamId, snapshot.teams.find((t) => t.id === b.teamId)?.shortCode ?? b.teamName])).values()]
    : []

  async function run(action: () => Promise<AdminSnapshot>) {
    setError(null)
    setPending(true)
    try {
      setSnapshot(await action())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rejected')
    } finally {
      setPending(false)
    }
  }

  async function bidFor(team: Team, amount = nextBid) {
    if (!lot || closed || pending) return
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
    <div className="font-body flex h-screen w-screen flex-col overflow-hidden bg-grid-paper text-brand-charcoal">
      <div className="flex shrink-0 items-baseline justify-between gap-4 border-b-[3px] border-brand-charcoal px-6 pt-3 pb-2">
        <h1 className="font-heading text-3xl font-black uppercase leading-none tracking-tight">
          Admin Super-Control Panel: {snapshot.room.name}
        </h1>
        <div className="flex shrink-0 items-baseline gap-3">
          <span className="font-heading text-[10px] font-bold uppercase tracking-widest">{snapshot.room.phase}</span>
          <span className="font-heading text-[10px] font-bold uppercase tracking-widest text-brand-charcoal/60">
            Round {snapshot.room.round} • {snapshot.queue.length} players left
          </span>
          <Link
            href="/"
            className="font-heading text-[10px] font-bold uppercase tracking-widest text-brand-charcoal/60 hover:text-brand-charcoal"
          >
            All rooms
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[24%_1fr_26%] grid-rows-[minmax(0,1fr)_auto] gap-3 p-3">
        {/* ── Row 1, left: command plate ─────────────────────── */}
        <div className="flex min-h-0 flex-col gap-3">
          <NeoPanel title="Lot Resolution" className="min-h-0 flex-1" bodyClassName="flex flex-col gap-1.5 p-1.5">
            <BrutalButton
              variant="blue"
              disabled={!lot || closed || !leaderId}
              onClick={() => run(() => markSold(roomId))}
              className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 text-base"
            >
              SOLD <Check size={16} aria-hidden />
            </BrutalButton>
            <BrutalButton
              variant="pink"
              disabled={!lot || closed || !!leaderId}
              onClick={() => run(() => markUnsold(roomId))}
              className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 text-base"
            >
              UNSOLD <X size={16} aria-hidden />
            </BrutalButton>
            <BrutalButton
              variant="yellow"
              disabled={!lot}
              onClick={() => run(() => undoLastBid(roomId))}
              className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 text-base"
            >
              UNDO BID <Undo2 size={16} aria-hidden />
            </BrutalButton>
          </NeoPanel>

          <NeoPanel title="Jump Bid" className="shrink-0" bodyClassName="flex flex-col gap-2 p-2">
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                // The auctioneer's call overrides the ladder and purse checks —
                // forceBid, not the team-seat placeBid path bidFor uses.
                if (lot && !closed && !pending && jumpBid) run(() => forceBid(roomId, effectiveJumpTeamId, Number(jumpBid)))
              }}
            >
              <label htmlFor="jump-team" className="font-heading text-[10px] font-bold uppercase tracking-widest">
                Team
              </label>
              <select
                id="jump-team"
                aria-label="Jump bid team"
                value={effectiveJumpTeamId}
                onChange={(e) => setJumpTeamId(e.target.value)}
                className="border-[3px] border-brand-charcoal bg-brand-white px-2 py-1.5 text-sm"
              >
                {snapshot.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortCode}
                  </option>
                ))}
              </select>
              <label htmlFor="jump-bid" className="font-heading text-[10px] font-bold uppercase tracking-widest">
                Amount
              </label>
              <div className="flex gap-2">
                <input
                  id="jump-bid"
                  inputMode="numeric"
                  placeholder={String(nextBid)}
                  value={jumpBid}
                  onChange={(e) => setJumpBid(e.target.value.replace(/\D/g, ''))}
                  className="min-w-0 flex-1 border-[3px] border-brand-charcoal bg-brand-white px-2 py-1.5 text-center text-sm tabular-nums"
                />
                <BrutalButton
                  type="submit"
                  variant="blue"
                  disabled={!lot || closed || pending || !jumpBid}
                  className="shrink-0 text-sm"
                >
                  Bid
                </BrutalButton>
              </div>
            </form>
          </NeoPanel>
        </div>

        {/* ── Row 1, centre: the lot on the block ────────────── */}
        {lot ? (
          <PlayerAuctionCard
            player={lot.player}
            currentBid={lot.currentBid}
            leaderShortCode={leader?.shortCode ?? null}
            purseLabel="Purse"
            purseValue={leader?.purseRemaining ?? 0}
            className="min-h-0"
          />
        ) : (
          <section className="flex min-h-0 flex-col items-center justify-center border-[3px] border-brand-charcoal bg-brand-white">
            <h2 className="font-heading text-4xl font-black uppercase tracking-tight">No lot on the block</h2>
            <p className="font-heading mt-2 text-sm font-bold uppercase tracking-widest text-brand-charcoal/60">
              Load the next player to start bidding
            </p>
          </section>
        )}

        {/* ── Row 1, right: status + operator controls ───────── */}
        <div className="flex min-h-0 flex-col gap-3">
          {biddingTeamCodes.length > 0 && (
            <p className="font-heading shrink-0 text-[10px] font-bold uppercase tracking-widest text-brand-charcoal/70">
              In the fight: {biddingTeamCodes.join(', ')}
            </p>
          )}

          <p className="font-heading shrink-0 text-right text-[10px] font-bold uppercase tracking-widest text-brand-charcoal/60">
            System security: admin access only
          </p>

          <NeoPanel
            title="Admin Simulation Controls"
            className="min-h-0 flex-1"
            bodyClassName="flex flex-col gap-1.5 p-1.5"
          >
            <div className="flex shrink-0 gap-1.5">
              <BrutalButton
                variant="yellow"
                onClick={() => run(() => advanceToNextLot(roomId))}
                className="min-w-0 flex-1 px-3 py-1.5 text-sm"
              >
                [START LOT]
              </BrutalButton>
              <BrutalButton
                variant="yellow"
                onClick={() => run(() => setPhase(roomId, paused ? 'LIVE' : 'PAUSED'))}
                className="flex min-w-0 flex-1 items-center justify-center gap-1 px-3 py-1.5 text-sm"
              >
                {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
                {paused ? '[RESUME]' : '[PAUSE]'}
              </BrutalButton>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <BrutalButton
                variant="yellow"
                disabled={!lot}
                onClick={() => run(() => controlTimer(roomId, 'reset'))}
                className="flex min-w-0 flex-1 items-center justify-center gap-1 px-2 py-1.5 text-xs leading-tight"
              >
                <RotateCcw size={12} aria-hidden /> [RESET TIMER]
              </BrutalButton>
              {/* A dispute is resolved by rolling the lot back to the previous
               * bid — the same server action the Z shortcut uses. */}
              <BrutalButton
                variant="yellow"
                disabled={!lot}
                onClick={() => run(() => undoLastBid(roomId))}
                className="min-w-0 flex-1 px-2 py-1.5 text-xs leading-tight"
              >
                [DISPUTE]
              </BrutalButton>
            </div>

            <BrutalButton
              variant="yellow"
              onClick={() => setShowEndConfirm(true)}
              className="mt-auto flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 text-base"
            >
              END AUCTION <Octagon size={16} aria-hidden />
            </BrutalButton>
          </NeoPanel>
        </div>

        {/* ── Row 2: tracker (doubles as the bid grid) + log ─── */}
        <TeamBidTracker
          teams={snapshot.teams}
          leaderId={leaderId}
          className="col-span-2 h-[30vh]"
          onPick={(team) => bidFor(snapshot.teams.find((t) => t.id === team.id)!)}
          pickBlocked={(team) => {
            if (!lot || closed) return 'No lot on the block'
            if (pending) return 'Processing previous bid…'
            const full = snapshot.teams.find((t) => t.id === team.id)!
            return bidRejectionReason(full, lot, nextBid)
          }}
        />

        <BiddingLog
          className="h-[30vh]"
          rows={[...(lot?.bidHistory ?? [])].reverse().map((bid) => ({
            key: `${bid.teamId}-${bid.timestamp}`,
            label: snapshot.teams.find((t) => t.id === bid.teamId)?.shortCode ?? bid.teamName,
            amount: bid.amount,
          }))}
        />
      </div>

      {lot && closed && (
        <p className="font-heading shrink-0 border-t-[3px] border-brand-charcoal bg-brand-yellow px-6 py-1 text-[11px] font-bold uppercase tracking-widest">
          {lot.status} — press Z to put this lot back on the block, or start the next lot
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="fixed bottom-10 left-1/2 z-30 -translate-x-1/2 border-[3px] border-brand-charcoal bg-brand-pink px-5 py-2 font-heading text-sm font-black uppercase tracking-widest shadow-brutal"
        >
          {error}
        </p>
      )}

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
              className="max-w-sm border-[3px] border-brand-charcoal bg-brand-white p-6 shadow-brutal-lg"
            >
              <h2 className="font-heading text-xl font-bold">Are you sure?</h2>
              <p className="mt-2 text-sm text-brand-charcoal/70">
                Ending the auction closes the room for every team. Unsold players stay unsold.
              </p>
              <div className="mt-5 flex gap-3">
                <BrutalButton
                  variant="pink"
                  onClick={async () => {
                    await run(() => setPhase(roomId, 'COMPLETED'))
                    setShowEndConfirm(false)
                  }}
                >
                  End auction
                </BrutalButton>
                <BrutalButton variant="plain" onClick={() => setShowEndConfirm(false)}>
                  Cancel
                </BrutalButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="telemetry-footer shrink-0">
        {`// NEO-GRID POP SYSTEM TELEMETRY v2.1 // DEPLOYED // NEXT ${formatMoney(nextBid)} //`}
      </div>
    </div>
  )
}
