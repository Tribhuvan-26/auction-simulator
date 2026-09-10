'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { useLotEntrance } from '@/hooks/use-lot-entrance'
import { SoldStamp } from '@/components/ui/sold-stamp'
import {
  BiddingLog,
  CurrentStatus,
  NeoPanel,
  PaletteReference,
  PlayerAuctionCard,
  TeamBidTracker,
} from '@/components/ui/neo-grid'
import { getPublicSnapshot, type PublicSnapshot } from '@/app/admin/[roomId]/actions'
import { formatMoney } from '@/lib/money'

export function DisplayBoard({
  roomId,
  initialSnapshot,
}: {
  roomId: string
  initialSnapshot: PublicSnapshot
}) {
  // The stamp is driven by the socket event, not by lot status, so it fires once
  // on the transition instead of staying up for as long as the lot sits closed.
  const [stamp, setStamp] = useState<'SOLD' | 'UNSOLD' | null>(null)
  const stampTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [bidPulse, setBidPulse] = useState(false)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { snapshot } = useLiveSnapshot(roomId, initialSnapshot, getPublicSnapshot, (event) => {
    if (event.type === 'BID') {
      setBidPulse(true)
      clearTimeout(pulseTimer.current)
      pulseTimer.current = setTimeout(() => setBidPulse(false), 1400)
      return
    }
    if (event.type !== 'SOLD' && event.type !== 'UNSOLD') return
    setStamp(event.type)
    clearTimeout(stampTimer.current)
    stampTimer.current = setTimeout(() => setStamp(null), 4000)
  })

  useEffect(
    () => () => {
      clearTimeout(stampTimer.current)
      clearTimeout(pulseTimer.current)
    },
    []
  )

  const lot = snapshot.currentLot
  const leader = snapshot.teams.find((t) => t.id === lot?.currentBiddingTeamId)
  const cardRef = useLotEntrance<HTMLDivElement>(lot?.id ?? 'none')

  return (
    <main className="font-body relative flex h-screen w-screen flex-col overflow-hidden bg-grid-paper text-brand-charcoal">
      <h1 className="shrink-0 border-b-[3px] border-brand-charcoal px-6 pt-3 pb-2 font-heading text-3xl font-black uppercase leading-none tracking-tight">
        IPL Auction: {snapshot.room.name}
      </h1>

      <div className="grid min-h-0 flex-1 grid-cols-[24%_1fr_26%] grid-rows-[1fr_auto] gap-3 p-3">
        {/* ── Row 1, left: palette + room state ──────────────── */}
        <div className="flex min-h-0 flex-col gap-3">
          <PaletteReference className="shrink-0" />
          <NeoPanel title="Auction State" className="min-h-0 flex-1" bodyClassName="flex flex-col gap-2 p-2">
            <Readout label="Phase" value={snapshot.room.phase} />
            <Readout label="Round" value={String(snapshot.room.round)} />
            <Readout label="Players sold" value={String(snapshot.soldLog.length)} />
            <Readout
              label="Leading"
              value={leader ? leader.shortCode : '—'}
              accent={leader?.colorAccent}
            />
          </NeoPanel>
        </div>

        {/* ── Row 1, centre: the lot on the block ────────────── */}
        <div ref={cardRef} className={`flex min-h-0 flex-col ${bidPulse ? 'anim-bid-pop' : ''}`}>
          {lot ? (
            <PlayerAuctionCard
              player={lot.player}
              currentBid={lot.currentBid}
              leaderShortCode={leader?.shortCode ?? null}
              purseLabel="Purse"
              purseValue={leader?.purseRemaining ?? 0}
              className="min-h-0 flex-1"
            />
          ) : (
            <section className="flex min-h-0 flex-1 flex-col items-center justify-center border-[3px] border-brand-charcoal bg-brand-white">
              <h2 className="font-heading text-5xl font-black uppercase tracking-tight">Next lot loading</h2>
            </section>
          )}
        </div>

        {/* ── Row 1, right: live state + the room's running ledger ── */}
        <div className="flex min-h-0 flex-col gap-3">
          <CurrentStatus
            lotLabel={lot ? `Lot ${lot.lotNumber}` : 'No lot'}
            state={lot ? lot.status : 'AWAITING LOT'}
            seconds={lot ? lot.timerSeconds : null}
            className="shrink-0"
          />
          <NeoPanel title="Sold Ledger" className="min-h-0 flex-1" bodyClassName="overflow-hidden p-2">
            <ul className="scrollbar-thin-dark flex h-full flex-col gap-1.5 overflow-y-auto pr-1">
              {snapshot.soldLog.map((s) => (
                <li
                  key={s.id}
                  className="flex shrink-0 items-baseline justify-between gap-2 border-[3px] border-brand-charcoal px-2 py-1"
                >
                  <span className="truncate text-xs font-bold">{s.playerName}</span>
                  <span className="font-heading shrink-0 text-xs font-black tabular-nums">
                    {formatMoney(s.price)} [{s.teamShortCode}]
                  </span>
                </li>
              ))}
              {snapshot.soldLog.length === 0 && (
                <li className="font-heading px-1 text-xs font-bold uppercase tracking-widest text-brand-charcoal/50">
                  Nothing sold yet
                </li>
              )}
            </ul>
          </NeoPanel>
        </div>

        {/* ── Row 2: tracker + log ───────────────────────────── */}
        <TeamBidTracker teams={snapshot.teams} leaderId={leader?.id ?? null} className="col-span-2 h-[30vh]" />

        <BiddingLog
          className="h-[30vh]"
          rows={[...(lot?.bidHistory ?? [])].reverse().map((bid) => ({
            key: `${bid.teamId}-${bid.timestamp}`,
            label: snapshot.teams.find((t) => t.id === bid.teamId)?.shortCode ?? bid.teamName,
            amount: bid.amount,
          }))}
        />
      </div>

      {/* The sold ticker is the room's running history — it keeps the bottom
       * strip when there is something to scroll, telemetry takes it otherwise. */}
      {snapshot.soldLog.length > 0 ? (
        <div className="shrink-0 overflow-hidden border-t-[3px] border-brand-charcoal bg-brand-charcoal py-1.5">
          <div className="anim-marquee flex w-max gap-10 whitespace-nowrap font-heading text-sm text-brand-white">
            {[...snapshot.soldLog, ...snapshot.soldLog].map((s, i) => (
              <span key={`${s.id}-${i}`}>
                {s.playerName}
                <span className="mx-2 text-brand-yellow tabular-nums">{formatMoney(s.price)}</span>
                <span className="text-brand-blue">[{s.teamShortCode}]</span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="telemetry-footer shrink-0">{'// NEO-GRID POP SYSTEM TELEMETRY v2.1 // DEPLOYED //'}</div>
      )}

      <AnimatePresence>{stamp && <SoldStamp key={stamp} kind={stamp} />}</AnimatePresence>
    </main>
  )
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-[3px] border-brand-charcoal px-2 py-1">
      <span className="font-heading text-[10px] font-bold uppercase tracking-widest text-brand-charcoal/70">
        {label}
      </span>
      <span
        className="font-heading truncate text-lg font-black tracking-tight tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </div>
  )
}
