'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { useLotEntrance } from '@/hooks/use-lot-entrance'
import { SoldStamp } from '@/components/ui/sold-stamp'
import { Model3D } from '@/components/ui/model-3d'
import { GlobalHeader } from '@/components/ui/global-header'
import { GlobalFooter } from '@/components/ui/global-footer'
import { BiddingLogTable } from '@/components/auction/bidding-log-table'
import { TeamCrest } from '@/components/ui/team-crest'
import { LotPhoto } from '@/components/auction/lot-photo'
import { SoldCelebration } from '@/components/auction/sold-celebration'
import { ResultsTicker } from '@/components/auction/results-ticker'
import {
  getPublicSnapshot,
  type PublicSnapshot,
  type RoomPlayerItem,
} from '@/app/admin/[roomId]/actions'
import { RatingPanel } from '@/components/auction/rating-panel'
import { formatMoney } from '@/lib/money'

export function DisplayBoard({
  roomId,
  initialSnapshot,
  roomPlayers = [],
}: {
  roomId: string
  initialSnapshot: PublicSnapshot
  roomPlayers?: RoomPlayerItem[]
}) {
  const [stamp, setStamp] = useState<'SOLD' | 'UNSOLD' | null>(null)
  const stampTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [bidPulse, setBidPulse] = useState(false)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [soldTrigger, setSoldTrigger] = useState<number>(0)
  const lastLotStatusRef = useRef(initialSnapshot.currentLot?.status)

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

  // The one place the celebration fires: the lot turning SOLD in the snapshot
  useEffect(() => {
    const currentStatus = snapshot.currentLot?.status
    if (lastLotStatusRef.current !== 'SOLD' && currentStatus === 'SOLD') {
      setSoldTrigger((t) => t + 1)
    }
    lastLotStatusRef.current = currentStatus
  }, [snapshot.currentLot?.status])

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

  const activeDisplayPlayer = lot?.player ?? null

  const displayRole = (activeDisplayPlayer?.role || 'BATTER').replace('_', ' ').toUpperCase()
  const displayPhoto = activeDisplayPlayer?.photoUrl || null

  return (
    <div className="relative flex h-screen w-full flex-col pb-16 text-white overflow-hidden">
      {/* Brutalist Environmental Backdrop matching Reference & Figma Asset */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/landing/ipl-auction-environment.jpg"
        alt="IPL Auction Environment"
        className="fixed inset-0 z-0 h-full w-full object-cover object-[75%_center] pointer-events-none select-none"
      />

      {/* Subtle Atmospheric Gradient */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />

      {/* Global Broadcast Header */}
      <GlobalHeader roomName={snapshot.room.name || 'ROOM 1'} phase={snapshot.room.phase} />

      {/* Broadcast Sub-Banner (Screenshot 2 Aesthetic) */}
      <div className="relative z-10 flex flex-wrap items-center justify-between border-b border-white/10 bg-[#121215]/90 px-4 md:px-8 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="font-heading text-lg sm:text-xl font-black uppercase tracking-wider text-white">
            IPL AUCTION: {snapshot.room.name || 'ROOM 1'}
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 bg-[#2074D5]/20 border border-[#2074D5]/50 text-[#2074D5] font-mono text-[9px] font-black uppercase tracking-widest">
            {snapshot.room.phase || 'LIVE'}
          </span>
          <span className="font-mono text-[10px] text-white/50 tracking-wider">
            {roomPlayers.length > 0 ? roomPlayers.filter((p) => p.status === 'UPCOMING').length : 253} PLAYERS LEFT
          </span>
        </div>
      </div>

      {/* Main Composition: left sidebar (details + log) | big photo stage */}
      <main className="relative z-10 grid flex-1 grid-cols-1 grid-rows-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[520px_1fr] gap-4 p-4 lg:px-6 min-h-0">
        {/* ── Left Sidebar: lot details + bidding log (sized off the screen height so it never scrolls) ── */}
        <aside ref={cardRef} className={`flex h-full min-h-0 min-w-0 flex-col gap-[1.2vh] ${bidPulse ? 'anim-bid-pop' : ''}`}>
          <div className="font-condensed text-[4vh] leading-none font-black text-white tracking-tight">
            LOT {lot ? lot.lotNumber : '1'}{' '}
            <span className="text-white/30 text-[2.6vh] font-normal">/ {roomPlayers.length || 254}</span>
          </div>

          <div className="bg-[#2074D5] px-5 py-[1.2vh] shadow-md">
            <h1 className="font-condensed text-[5.4vh] font-black uppercase tracking-tight text-white leading-none truncate">
              {activeDisplayPlayer?.name || 'AWAITING NEXT LOT'}
            </h1>
            <div className="mt-[0.8vh] flex flex-wrap items-center gap-3 font-mono text-[1.7vh] font-bold uppercase tracking-wider text-white/85">
            <span>
              {activeDisplayPlayer?.setNumber || 'SET 1'} • {displayRole}
            </span>
            {activeDisplayPlayer && (
              <>
                <span
                  className={`border-2 border-brand-charcoal px-2 py-0.5 font-condensed text-xl font-black tracking-widest text-brand-charcoal shadow-[2px_2px_0_#282828] ${
                    activeDisplayPlayer.isOverseas ? 'bg-brand-yellow' : 'bg-brand-white'
                  }`}
                >
                  {activeDisplayPlayer.isOverseas ? 'OVERSEAS' : 'INDIAN'}
                </span>
                <span className="text-sm font-medium normal-case text-white/70">
                  {activeDisplayPlayer.nationality}
                </span>
              </>
            )}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_17vh] gap-[1.2vh]">
            <div className="bg-[#EB547C] px-5 py-[1.2vh] text-white shadow-[0_0_20px_rgba(235,84,124,0.3)]">
              <span className="font-mono text-[1.7vh] font-black uppercase tracking-[0.2em] text-white/90 block">
                CURRENT BID
              </span>
              <div className="font-condensed text-[8vh] font-black leading-none tracking-tight text-white tabular-nums">
                {lot ? formatMoney(lot.currentBid) : '—'}
              </div>
            </div>
            <RatingPanel name={activeDisplayPlayer?.name ?? ''} compact />
          </div>

          <div className="grid grid-cols-3 gap-px bg-white/15 border border-white/15">
            <div className="col-span-3 bg-[#17171A] px-4 py-[1vh]">
              <span className="font-mono text-[1.5vh] font-bold uppercase tracking-wider text-white/60 block">HIGHEST BIDDER</span>
              <span className="font-condensed text-[3.4vh] leading-tight font-black uppercase text-white whitespace-nowrap flex items-center gap-2">
                {leader && (
                  <TeamCrest
                    shortCode={leader.shortCode}
                    name={leader.name}
                    colorAccent={leader.colorAccent}
                    logoUrl={leader.logoUrl}
                    mark
                    className="h-[3.6vh] w-[3.6vh] shrink-0"
                  />
                )}
                {leader ? leader.name : 'Waiting for bid'}
              </span>
            </div>
            <div className="bg-[#17171A] px-4 py-[1vh]">
              <span className="font-mono text-[1.5vh] font-bold uppercase tracking-wider text-white/60 block">ROLE</span>
              <span className="font-condensed text-[3.2vh] leading-tight font-black uppercase text-white block truncate">{displayRole}</span>
            </div>
            <div className="bg-[#17171A] px-4 py-[1vh]">
              <span className="font-mono text-[1.5vh] font-bold uppercase tracking-wider text-white/60 block">BASE PRICE</span>
              <span className="font-condensed text-[3.2vh] leading-tight font-black uppercase text-brand-yellow block tabular-nums">
                {activeDisplayPlayer ? formatMoney(activeDisplayPlayer.basePrice) : '—'}
              </span>
            </div>
            <div className="bg-[#17171A] px-4 py-[1vh]">
              <span className="font-mono text-[1.5vh] font-bold uppercase tracking-wider text-white/60 block">MATCHES</span>
              <span className="font-condensed text-[3.2vh] leading-tight font-black uppercase text-white block tabular-nums">
                {activeDisplayPlayer?.matches ?? 0}
              </span>
            </div>
          </div>

          <BiddingLogTable
            className="min-h-0 flex-1 overflow-hidden"
            title="BIDDING LOG"
            maxRows={5}
            rows={[...(lot?.bidHistory ?? [])].reverse().map((bid) => {
              const team = snapshot.teams.find((t) => t.id === bid.teamId)
              return {
                key: `${bid.teamId}-${bid.timestamp}`,
                teamCode: team?.shortCode ?? bid.teamName,
                teamName: bid.teamName,
                amount: bid.amount,
                timestamp: bid.timestamp,
                accentColor: team?.colorAccent,
              }
            })}
          />
        </aside>

        {/* ── Photo Stage ── */}
        <section className="relative flex h-full min-h-0 items-center justify-center border border-white/10 bg-[#161619]/80 shadow-2xl backdrop-blur-md min-w-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-brand-yellow z-10" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-brand-yellow z-10" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-brand-yellow z-10" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-brand-yellow z-10" />

          {!activeDisplayPlayer ? (
            <Model3D src="/models/trophy.glb" loop className="h-full w-full" />
          ) : displayPhoto ? (
            <LotPhoto
              src={displayPhoto}
              alt={activeDisplayPlayer.name}
              soldTo={lot?.status === 'SOLD' ? leader ?? null : null}
              className="relative h-full aspect-square max-w-full"
            />
          ) : (
            <div className="font-condensed text-9xl font-black text-white/20">
              {activeDisplayPlayer.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
          )}
        </section>
      </main>

      {/* News-channel results ticker, pinned to the bottom */}
      <ResultsTicker results={snapshot.resultLog} />

      {/* Global Architectural Footer */}
      <GlobalFooter
        tagline="MORE THAN A TOURNAMENT. A LEGACY IN MOTION."
        year="IPL AUCTION 2026"
        showPalette={false}
      />

      {/* SOLD / UNSOLD Stamp Animation */}
      <AnimatePresence>{stamp && <SoldStamp key={stamp} kind={stamp} />}</AnimatePresence>

      {/* Player Sold Celebration Animation Overlay */}
      <SoldCelebration
        trigger={soldTrigger}
        player={lot?.player ? {
          name: lot.player.name,
          price: lot.currentBid,
          teamName: leader?.name,
        } : undefined}
      />
    </div>
  )
}
