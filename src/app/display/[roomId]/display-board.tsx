'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { useLotEntrance } from '@/hooks/use-lot-entrance'
import { SoldStamp } from '@/components/ui/sold-stamp'
import { PlayerAuctionCard } from '@/components/ui/neo-grid'
import { getPublicSnapshot, type PublicSnapshot } from '@/app/admin/[roomId]/actions'

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

      <div
        ref={cardRef}
        className={`mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-3 ${bidPulse ? 'anim-bid-pop' : ''}`}
      >
        {lot ? (
          <PlayerAuctionCard
            player={lot.player}
            currentBid={lot.currentBid}
            leaderShortCode={leader?.shortCode ?? null}
            leaderTeam={leader}
            className="min-h-0 flex-1"
          />
        ) : (
          <section className="flex min-h-0 flex-1 flex-col items-center justify-center border-[3px] border-brand-charcoal bg-brand-white">
            <h2 className="font-heading text-5xl font-black uppercase tracking-tight">Next lot loading</h2>
          </section>
        )}
      </div>

      <AnimatePresence>{stamp && <SoldStamp key={stamp} kind={stamp} />}</AnimatePresence>
    </main>
  )
}
