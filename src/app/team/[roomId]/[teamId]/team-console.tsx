'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gavel, Hand, TriangleAlert, X } from 'lucide-react'
import { BrutalButton } from '@/components/ui/brutal-button'
import { TeamCrest } from '@/components/ui/team-crest'
import {
  BiddingLog,
  CurrentStatus,
  NeoPanel,
  PaletteReference,
  PlayerAuctionCard,
} from '@/components/ui/neo-grid'
import { bidRejectionReason, getNextBidAmount } from '@/lib/bid-rules'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { formatMoney } from '@/lib/money'
import { getPublicSnapshot, placeBid, type PublicSnapshot } from '@/app/admin/[roomId]/actions'

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
  // A pass is this seat's own decision to sit a lot out — it never leaves the
  // browser, so it clears itself the moment the auctioneer loads a new lot.
  const [passedLotId, setPassedLotId] = useState<string | null>(null)
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
    navigator.vibrate?.([100, 50, 100])
    clearTimeout(outbidTimer.current)
    outbidTimer.current = setTimeout(() => setOutbid(false), 6000)
  })

  const team = snapshot.teams.find((t) => t.id === teamId)!
  const lot = snapshot.currentLot
  const closed = lot?.status === 'SOLD' || lot?.status === 'UNSOLD'
  const leading = lot?.currentBiddingTeamId === teamId
  const leader = snapshot.teams.find((t) => t.id === lot?.currentBiddingTeamId)
  const passed = !!lot && passedLotId === lot.id

  const nextBid = lot
    ? lot.status === 'BIDDING'
      ? getNextBidAmount(lot.currentBid, lot.player.basePrice)
      : lot.currentBid
    : 0

  const rejection = lot && !closed ? bidRejectionReason(team, lot, nextBid) : null
  const canBid = !!lot && !closed && !rejection && !leading && !passed && !pending

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
  const bidState = closed
    ? (lot?.status ?? 'IDLE')
    : leading
      ? 'YOU HOLD'
      : outbid
        ? 'OUTBID'
        : lot
          ? lot.status
          : 'AWAITING LOT'

  return (
    <div className="font-body flex h-screen w-screen flex-col overflow-hidden bg-grid-paper text-brand-charcoal">
      <h1 className="shrink-0 border-b-[3px] border-brand-charcoal px-6 pt-3 pb-2 font-heading text-3xl font-black uppercase leading-none tracking-tight">
        Team Dashboard: {team.name}
      </h1>

      <div className="grid min-h-0 flex-1 grid-cols-[24%_46%_1fr] grid-rows-[1fr_auto] gap-3 p-3">
        {/* ── Row 1, left: reference + franchise identity ────── */}
        <div className="flex min-h-0 flex-col gap-3">
          <PaletteReference className="shrink-0" />
          <NeoPanel title="Franchise" className="min-h-0 flex-1" bodyClassName="flex flex-col p-2">
            <div className="flex min-h-0 flex-1 items-center justify-center border-[3px] border-brand-charcoal p-1">
              <TeamCrest
                shortCode={team.shortCode}
                name={team.name}
                colorAccent={team.colorAccent}
                logoUrl={team.logoUrl}
                className="h-full max-h-full w-auto"
              />
            </div>
            <dl className="mt-2 grid shrink-0 grid-cols-2 gap-2">
              <MiniStat label="Purse" value={formatMoney(team.purseRemaining)} />
              <MiniStat label="Squad" value={`${team.squadCount}/${team.squadMax}`} />
              <MiniStat label="Overseas" value={`${team.overseasSlotsUsed}/${team.overseasSlotsMax}`} />
              <MiniStat label="Round" value={String(snapshot.room.round)} />
            </dl>
          </NeoPanel>
        </div>

        {/* ── Row 1, centre: the lot on the block ────────────── */}
        {lot ? (
          <PlayerAuctionCard
            player={lot.player}
            currentBid={lot.currentBid}
            leaderShortCode={leader?.shortCode ?? null}
            purseLabel="Purse"
            purseValue={team.purseRemaining}
            className="min-h-0"
          />
        ) : (
          <section className="flex min-h-0 flex-col items-center justify-center border-[3px] border-brand-charcoal bg-brand-white">
            <h2 className="font-heading text-4xl font-black uppercase tracking-tight">Between lots</h2>
            <p className="font-heading mt-2 text-sm font-bold uppercase tracking-widest text-brand-charcoal/60">
              The auctioneer is loading the next player
            </p>
          </section>
        )}

        {/* ── Row 1, right: status + bidding controls ────────── */}
        <div className="flex min-h-0 flex-col gap-3">
          <CurrentStatus
            lotLabel={lot ? `Lot ${lot.lotNumber}` : 'No lot'}
            state={bidState}
            seconds={lot ? lot.timerSeconds : null}
            className="shrink-0"
          />

          <NeoPanel
            title="Bidding Control Panel"
            className="min-h-0 flex-1"
            bodyClassName="flex flex-col gap-2 p-2"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-[3px] border-brand-charcoal px-2 py-1">
              <span className="font-heading text-[10px] font-bold uppercase tracking-widest">
                Your bidding actions
              </span>
              <span className="font-heading text-sm font-black tabular-nums">
                {canBid ? formatMoney(nextBid) : '—'}
              </span>
            </div>

            <BrutalButton
              variant={outbid ? 'pink' : 'blue'}
              disabled={!canBid}
              onClick={raisePaddle}
              className="flex shrink-0 items-center justify-between gap-2 py-3 text-2xl"
            >
              {outbid ? 'COUNTER' : 'BID'} <Gavel size={22} aria-hidden />
            </BrutalButton>

            <BrutalButton
              variant="pink"
              disabled={!lot || closed || leading || passed}
              onClick={() => lot && setPassedLotId(lot.id)}
              className="flex shrink-0 items-center justify-between gap-2 py-3 text-2xl"
            >
              PASS <Hand size={22} aria-hidden />
            </BrutalButton>

            <BrutalButton
              variant="yellow"
              disabled
              title="A placed bid cannot be retracted — the auctioneer resolves disputes"
              className="flex shrink-0 items-center justify-between gap-2 py-3 text-2xl"
            >
              WITHDRAW <X size={22} aria-hidden />
            </BrutalButton>

            <p className="font-heading mt-auto shrink-0 text-[10px] font-bold uppercase leading-snug tracking-widest text-brand-charcoal/60">
              {leading
                ? 'You hold the highest bid'
                : passed
                  ? 'Passed — sitting this lot out'
                  : (rejection ?? (canBid ? 'Press space to raise' : 'Waiting for the auctioneer'))}
            </p>
          </NeoPanel>
        </div>

        {/* ── Row 2, left + centre: squad ─────────────────────── */}
        <NeoPanel
          title="Your Team Status"
          right={
            <span className="font-heading text-[10px] font-bold tabular-nums text-brand-white/70">
              Purse {formatMoney(team.purseRemaining)} • Squad {team.squadCount}/{team.squadMax}
            </span>
          }
          className="col-span-2 h-[26vh]"
          bodyClassName="overflow-hidden p-2"
        >
          <ul className="scrollbar-thin-dark grid h-full grid-cols-5 content-start gap-2 overflow-y-auto pr-1">
            {squadSlots.map((player, i) =>
              player ? (
                <motion.li
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  title={`${player.name} — ${formatMoney(player.price)}`}
                  className="flex items-baseline justify-between gap-1 border-[3px] border-brand-charcoal px-2 py-1"
                >
                  <span className="truncate text-xs font-bold">
                    [{i + 1}] {player.name}
                  </span>
                  <span className="font-heading shrink-0 text-[10px] font-black tabular-nums">
                    {formatMoney(player.price)}
                  </span>
                </motion.li>
              ) : (
                <li
                  key={`empty-${i}`}
                  className="font-heading border-[3px] border-brand-charcoal/25 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-charcoal/40"
                >
                  Slot {i + 1}
                </li>
              )
            )}
          </ul>
        </NeoPanel>

        {/* ── Row 2, right: bidding log ───────────────────────── */}
        <BiddingLog
          className="h-[26vh]"
          rows={[...(lot?.bidHistory ?? [])].reverse().map((bid) => ({
            key: `${bid.teamId}-${bid.timestamp}`,
            label: snapshot.teams.find((t) => t.id === bid.teamId)?.shortCode ?? bid.teamName,
            amount: bid.amount,
          }))}
        />
      </div>

      <AnimatePresence>
        {(error || (outbid && !leading)) && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-10 left-1/2 z-30 -translate-x-1/2 border-[3px] border-brand-charcoal bg-brand-pink px-5 py-2 font-heading text-sm font-black uppercase tracking-widest shadow-brutal"
          >
            {error ? (
              <span className="flex items-center gap-2">
                <TriangleAlert size={14} aria-hidden /> {error}
              </span>
            ) : (
              'Outbid — counter now'
            )}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="telemetry-footer shrink-0">{'// NEO-GRID POP SYSTEM TELEMETRY v2.1 // DEPLOYED //'}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-[3px] border-brand-charcoal px-2 py-1">
      <dt className="font-heading text-[9px] font-bold uppercase tracking-widest text-brand-charcoal/70">
        {label}
      </dt>
      <dd className="font-heading text-base font-black leading-tight tabular-nums">{value}</dd>
    </div>
  )
}
