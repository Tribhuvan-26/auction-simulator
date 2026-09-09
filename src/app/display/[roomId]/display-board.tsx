'use client'

import { formatMoney } from '@/lib/money'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { useLotEntrance } from '@/hooks/use-lot-entrance'
import { CountdownRing } from '@/components/ui/countdown-ring'
import { SectionHeader } from '@/components/ui/brutal-card'
import { BidNumber } from '@/components/ui/bid-number'
import { TeamChip } from '@/components/ui/team-chip'
import { SoldStamp } from '@/components/ui/sold-stamp'
import { PlayerAvatar } from '@/components/ui/player-avatar'
import { getPublicSnapshot, type PublicSnapshot } from '@/app/admin/[roomId]/actions'
import { TIMER_DEFAULT_SECONDS } from '@/lib/auction-constants'
import { Activity, BarChart3, Target, Percent } from 'lucide-react'

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
  const ringTotal = lot ? Math.max(TIMER_DEFAULT_SECONDS, lot.timerSeconds) : TIMER_DEFAULT_SECONDS
  const cardRef = useLotEntrance<HTMLElement>(lot?.id ?? 'none')

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-grid-paper text-brand-charcoal">
      <div className="relative flex items-center justify-between border-b-[3px] border-brand-charcoal px-8 py-4">
        <h1 className="font-heading text-2xl font-black uppercase">IPL Auction: {snapshot.room.name}</h1>
        <span className="border-[3px] border-brand-charcoal bg-brand-yellow px-3 py-1 font-heading font-bold text-brand-charcoal">
          {snapshot.room.phase}
        </span>
      </div>

      {lot ? (
        <div className="relative grid flex-1 content-center items-center gap-10 px-8 py-10 lg:grid-cols-[1.4fr_1fr]">
          <section
            ref={cardRef}
            className="layer-plate layer-plate-blue shadow-glow-blue relative flex flex-col items-center border-[6px] border-brand-blue bg-brand-white p-8 text-center text-brand-charcoal"
          >
            <span className="absolute right-6 top-6 shrink-0 border-[3px] border-brand-charcoal bg-brand-yellow px-3 py-2 font-heading text-xl font-bold">
              Base {formatMoney(lot.player.basePrice)}
            </span>

            {/* Player photo is the focal point — always front-and-center, sized to
                dominate the card regardless of stats/name length around it. */}
            <PlayerAvatar
              name={lot.player.name}
              photoUrl={lot.player.photoUrl}
              className="h-56 w-56 shrink-0 text-6xl xl:h-64 xl:w-64"
            />

            <p className="mt-4 font-heading text-sm font-bold">{lot.player.setNumber}</p>
            <h2 className="font-heading text-6xl font-bold leading-[0.95] xl:text-7xl">{lot.player.name}</h2>
            <p className="mt-3 font-heading text-xl">
              {lot.player.role.replace('_', '-')} · {lot.player.isOverseas ? 'Overseas' : lot.player.nationality}
            </p>

            <dl className="mt-8 grid w-full grid-cols-2 gap-x-8 gap-y-2 font-heading md:grid-cols-4">
              <Stat icon={Activity} label="Matches" value={lot.player.matches} />
              <Stat icon={BarChart3} label="Runs" value={lot.player.runs} />
              <Stat icon={Target} label="Wickets" value={lot.player.wickets} />
              <Stat icon={Percent} label="Average" value={lot.player.average} />
            </dl>
          </section>

          <section className="flex flex-col gap-8">
            <div className="layer-plate layer-plate-yellow shadow-glow-yellow border-[6px] border-brand-charcoal bg-brand-white p-6 text-brand-charcoal">
              <SectionHeader className="-mx-6 -mt-6 mb-4">Current Bid</SectionHeader>
              <BidNumber value={lot.currentBid} className="block text-[6rem] leading-none xl:text-[8rem]" />
            </div>

            <div
              className={`layer-plate layer-plate-pink shadow-glow-pink flex items-center justify-between gap-4 border-[6px] border-brand-charcoal px-6 py-5 ${bidPulse ? 'anim-glow-pulse' : ''}`}
            >
              <div>
                <p className="font-heading text-sm font-bold uppercase opacity-80">Leading</p>
                <AnimatePresence mode="wait">
                  {leader ? (
                    <TeamChip
                      key={leader.id}
                      name={leader.name}
                      shortCode={leader.shortCode}
                      colorAccent={leader.colorAccent}
                      className="mt-1"
                    />
                  ) : (
                    <p key="none" className="mt-1 font-heading text-2xl font-bold">
                      No bids yet
                    </p>
                  )}
                </AnimatePresence>
              </div>
              <CountdownRing seconds={lot.timerSeconds} total={ringTotal} />
            </div>
          </section>
        </div>
      ) : (
        <div className="flex h-[60vh] items-center justify-center">
          <p className="font-heading text-5xl font-bold opacity-60">Next lot loading</p>
        </div>
      )}

      {snapshot.soldLog.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t-[3px] border-brand-charcoal bg-brand-charcoal py-3">
          <div className="anim-marquee flex w-max gap-10 whitespace-nowrap font-heading text-brand-white">
            {[...snapshot.soldLog, ...snapshot.soldLog].map((s, i) => (
              <span key={`${s.id}-${i}`} className="text-lg">
                {s.playerName}
                <span className="mx-2 text-brand-yellow tabular-nums">{s.price}</span>
                <span className="text-brand-blue">{s.teamShortCode}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>{stamp && <SoldStamp key={stamp} kind={stamp} />}</AnimatePresence>

      {/* The sold-log ticker already occupies the bottom strip once auctions start;
       * the telemetry footer only shows before it has anything to display. */}
      {snapshot.soldLog.length === 0 && (
        <div className="telemetry-footer absolute inset-x-0 bottom-0">
          // NEO-GRID POP SYSTEM TELEMETRY v2.1 // DEPLOYED //
        </div>
      )}
    </main>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  label: string
  value: number | null
}) {
  return (
    <div className="border-t-[3px] border-brand-charcoal pt-2">
      <dt className="flex items-center justify-center gap-1 text-sm font-bold">
        <Icon size={14} aria-hidden />
        {label}
      </dt>
      <dd className="text-3xl font-bold tabular-nums">{value || '—'}</dd>
    </div>
  )
}
