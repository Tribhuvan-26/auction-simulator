'use client'

import { formatMoney } from '@/lib/money'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { useLotEntrance } from '@/hooks/use-lot-entrance'
import { CountdownRing } from '@/components/ui/countdown-ring'
import { BidNumber } from '@/components/ui/bid-number'
import { TeamChip } from '@/components/ui/team-chip'
import { SoldStamp } from '@/components/ui/sold-stamp'
import { getAdminSnapshot, type AdminSnapshot } from '@/app/admin/[roomId]/actions'
import { TIMER_DEFAULT_SECONDS } from '@/lib/auction-constants'

export function DisplayBoard({
  roomId,
  initialSnapshot,
}: {
  roomId: string
  initialSnapshot: AdminSnapshot
}) {
  // The stamp is driven by the socket event, not by lot status, so it fires once
  // on the transition instead of staying up for as long as the lot sits closed.
  const [stamp, setStamp] = useState<'SOLD' | 'UNSOLD' | null>(null)
  const stampTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { snapshot } = useLiveSnapshot(roomId, initialSnapshot, getAdminSnapshot, (event) => {
    if (event.type !== 'SOLD' && event.type !== 'UNSOLD') return
    setStamp(event.type)
    clearTimeout(stampTimer.current)
    stampTimer.current = setTimeout(() => setStamp(null), 4000)
  })

  useEffect(() => () => clearTimeout(stampTimer.current), [])

  const lot = snapshot.currentLot
  const leader = snapshot.teams.find((t) => t.id === lot?.currentBiddingTeamId)
  const ringTotal = lot ? Math.max(TIMER_DEFAULT_SECONDS, lot.timerSeconds) : TIMER_DEFAULT_SECONDS
  const cardRef = useLotEntrance<HTMLElement>(lot?.id ?? 'none')

  return (
    <main className="relative flex-1 overflow-hidden bg-brand-charcoal text-brand-white">
      <div className="flex items-center justify-between border-b-[3px] border-brand-white/20 px-8 py-4">
        <h1 className="font-heading text-2xl font-bold">{snapshot.room.name}</h1>
        <span className="border-[3px] border-brand-white bg-brand-yellow px-3 py-1 font-heading font-bold text-brand-charcoal">
          {snapshot.room.phase}
        </span>
      </div>

      {lot ? (
        <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1.4fr_1fr]">
          <section ref={cardRef} className="border-[6px] border-brand-blue bg-brand-white p-8 text-brand-charcoal">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-heading text-sm font-bold">{lot.player.setNumber}</p>
                <h2 className="font-heading text-6xl font-bold leading-[0.95] xl:text-7xl">
                  {lot.player.name}
                </h2>
                <p className="mt-3 font-heading text-xl">
                  {lot.player.role.replace('_', '-')} · {lot.player.nationality}
                  {lot.player.isOverseas ? ' · overseas' : ''}
                </p>
              </div>
              <span className="shrink-0 border-[3px] border-brand-charcoal bg-brand-yellow px-3 py-2 font-heading text-xl font-bold">
                Base {formatMoney(lot.player.basePrice)}
              </span>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-2 font-heading md:grid-cols-4">
              <Stat label="Matches" value={lot.player.matches} />
              <Stat label="Runs" value={lot.player.runs} />
              <Stat label="Wickets" value={lot.player.wickets} />
              <Stat label="Average" value={lot.player.average} />
            </dl>
          </section>

          <section className="flex flex-col gap-6">
            <div className="border-[6px] border-brand-white bg-brand-white p-6 text-brand-charcoal">
              <p className="font-heading text-sm font-bold">Current bid</p>
              <BidNumber value={lot.currentBid} className="block text-[6rem] leading-none xl:text-[8rem]" />
            </div>

            <div className="flex items-center justify-between gap-4 border-[6px] border-brand-white px-6 py-5">
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
        <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t-[3px] border-brand-white/20 bg-brand-charcoal py-3">
          <div className="anim-marquee flex w-max gap-10 whitespace-nowrap font-heading">
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
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border-t-[3px] border-brand-charcoal pt-2">
      <dt className="text-sm font-bold">{label}</dt>
      <dd className="text-3xl font-bold tabular-nums">{value ?? '—'}</dd>
    </div>
  )
}
