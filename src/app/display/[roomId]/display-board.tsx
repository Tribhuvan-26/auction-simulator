'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { useLotEntrance } from '@/hooks/use-lot-entrance'
import { SoldStamp } from '@/components/ui/sold-stamp'
import { GlobalHeader } from '@/components/ui/global-header'
import { GlobalFooter } from '@/components/ui/global-footer'
import { LiveAuctionHero } from '@/components/auction/live-auction-hero'
import { CircularCountdown } from '@/components/auction/circular-countdown'
import { BiddingLogTable } from '@/components/auction/bidding-log-table'
import { PerformanceOverview } from '@/components/auction/performance-overview'
import { TeamCrest } from '@/components/ui/team-crest'
import { getPublicSnapshot, type PublicSnapshot } from '@/app/admin/[roomId]/actions'
import { getNextBidAmount } from '@/lib/bid-rules'
import { formatMoney } from '@/lib/money'

export function DisplayBoard({
  roomId,
  initialSnapshot,
}: {
  roomId: string
  initialSnapshot: PublicSnapshot
}) {
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

  const nextBid = lot
    ? lot.status === 'BIDDING'
      ? getNextBidAmount(lot.currentBid, lot.player.basePrice)
      : lot.currentBid
    : 0

  // Category matching
  const currentRole = (lot?.player.role || 'BATTER').toUpperCase()
  const isBatsman = currentRole.includes('BAT')
  const isBowler = currentRole.includes('BOWL')
  const isAllRounder = currentRole.includes('ALL')
  const isWicketkeeper = currentRole.includes('WICKET') || currentRole === 'WK'

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#141414] bg-concrete text-white overflow-x-hidden">
      {/* Global Broadcast Header with Live Beacon & IST Clock */}
      <GlobalHeader
        activeTab="auction"
        roomId={roomId}
        liveBeacon={true}
        location="CHENNAI, INDIA"
      />

      {/* Main 4-column composition matching Reference 2 */}
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[140px_1fr_160px] xl:grid-cols-[160px_1fr_180px] gap-4 p-4 lg:p-6 min-h-0">
        {/* ── Left Pillar: Lot Number & Category Navigation ── */}
        <aside className="hidden lg:flex flex-col justify-between border-r border-white/10 pr-4 py-2">
          <div className="flex flex-col gap-6">
            {/* LOT X / 577 */}
            <div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 block">
                LOT
              </span>
              <div className="font-condensed text-3xl font-black text-white tracking-tight mt-0.5">
                {lot ? lot.lotNumber : '—'} <span className="text-white/30 text-xl font-normal">/ 577</span>
              </div>
            </div>

            {/* CATEGORY SELECTOR LIST */}
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 block">
                CATEGORY
              </span>

              <nav className="flex flex-col gap-2 font-mono text-[11px] font-bold tracking-wider">
                <div
                  className={`flex items-center gap-2 py-1 transition-colors ${
                    isBatsman
                      ? 'border-l-2 border-[#2074D5] pl-2 text-white font-extrabold'
                      : 'pl-2 text-white/40'
                  }`}
                >
                  BATSMAN
                </div>

                <div
                  className={`flex items-center gap-2 py-1 transition-colors ${
                    isBowler
                      ? 'border-l-2 border-[#2074D5] pl-2 text-white font-extrabold'
                      : 'pl-2 text-white/40'
                  }`}
                >
                  BOWLER
                </div>

                <div
                  className={`flex items-center gap-2 py-1 transition-colors ${
                    isAllRounder
                      ? 'border-l-2 border-[#2074D5] pl-2 text-white font-extrabold'
                      : 'pl-2 text-white/40'
                  }`}
                >
                  ALL-ROUNDER
                </div>

                <div
                  className={`flex items-center gap-2 py-1 transition-colors ${
                    isWicketkeeper
                      ? 'border-l-2 border-[#2074D5] pl-2 text-white font-extrabold'
                      : 'pl-2 text-white/40'
                  }`}
                >
                  WICKETKEEPER
                </div>
              </nav>
            </div>
          </div>

          {/* Architectural Concrete Slogan */}
          <div className="py-4 border-t border-white/10">
            <span className="font-condensed text-[13px] font-black uppercase leading-tight tracking-wider text-white/25 block">
              SAME GAME
              <br />
              DIFFERENT
              <br />
              LEGENDS
            </span>
          </div>
        </aside>

        {/* ── Center Stage: Player Hero + Action Controls + Bottom Panels ── */}
        <section className="flex flex-col gap-4 min-w-0">
          {/* Active Player Hero Card */}
          <div ref={cardRef} className={bidPulse ? 'anim-bid-pop' : ''}>
            <LiveAuctionHero
              player={lot ? lot.player : null}
              currentBid={lot ? lot.currentBid : 0}
              leaderTeam={leader}
            />
          </div>

          {/* 3-Column Action Strip: CURRENT BID (Yellow) | PLACE YOUR BID | TIME REMAINING */}
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr_1fr] gap-4">
            {/* CURRENT BID - Monumental Yellow Plate */}
            <div className="flex flex-col justify-between border border-brand-yellow bg-brand-yellow p-4 text-[#282828] shadow-[0_0_20px_rgba(249,212,123,0.25)]">
              <div>
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#282828]/80 block">
                  CURRENT BID
                </span>
                <div className="font-condensed text-4xl sm:text-5xl font-black leading-none tracking-tight text-[#282828] mt-1 tabular-nums">
                  {formatMoney(lot ? lot.currentBid : 0)}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[#282828]/20 pt-2">
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#282828]/70">
                  HIGHEST BIDDER
                </span>
                <div className="flex items-center gap-1.5 font-condensed text-base font-black uppercase text-[#282828]">
                  {leader ? (
                    <>
                      <TeamCrest
                        shortCode={leader.shortCode}
                        name={leader.name}
                        colorAccent={leader.colorAccent}
                        logoUrl={leader.logoUrl}
                        mark
                        className="h-4 w-4"
                      />
                      <span>{leader.shortCode}</span>
                    </>
                  ) : (
                    <span>OPENING</span>
                  )}
                </div>
              </div>
            </div>

            {/* PLACE YOUR BID - Interactive Rung Stepper & Action Buttons */}
            <div className="flex flex-col justify-between border border-white/10 bg-[#1A1A1A] p-4">
              <div>
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70 block">
                  PLACE YOUR BID
                </span>

                {/* Stepper with next ladder rung */}
                <div className="mt-2 flex items-center justify-between border border-white/15 bg-[#222222] px-3 py-2">
                  <span className="font-mono text-lg font-bold text-white/40 cursor-not-allowed">
                    —
                  </span>
                  <span className="font-condensed text-2xl font-black text-white tabular-nums tracking-wide">
                    {formatMoney(nextBid)}
                  </span>
                  <span className="font-mono text-lg font-bold text-white/40 cursor-not-allowed">
                    +
                  </span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Link
                  href={`/team/${roomId}/${snapshot.teams[0]?.id || ''}`}
                  className="flex items-center justify-center bg-[#2074D5] hover:bg-blue-600 px-3 py-2.5 font-condensed text-base font-black uppercase tracking-wider text-white shadow-[0_0_12px_rgba(32,116,213,0.4)] transition-all"
                >
                  BID
                </Link>
                <div className="flex items-center justify-center border border-white/15 bg-[#222222] px-3 py-2.5 font-condensed text-sm font-bold uppercase tracking-wider text-white/60 cursor-not-allowed">
                  PASS
                </div>
                <div className="flex items-center justify-center border border-white/10 bg-[#1E1E1E] px-3 py-2.5 font-condensed text-sm font-bold uppercase tracking-wider text-white/30 cursor-not-allowed">
                  WITHDRAW
                </div>
              </div>
            </div>

            {/* TIME REMAINING - Circular Countdown Ring */}
            <div className="flex flex-col justify-between border border-white/10 bg-[#1A1A1A] p-4 text-center">
              <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70 block mb-1">
                TIME REMAINING
              </span>

              <CircularCountdown
                seconds={lot?.timerSeconds ?? null}
                totalSeconds={30}
                size={110}
                strokeWidth={7}
                className="my-auto py-1"
              />
            </div>
          </div>

          {/* Bottom Row: Bidding Log & Performance Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BiddingLogTable
              title="BIDDING LOG"
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

            <PerformanceOverview
              stats={{
                matches: lot?.player.matches,
                runs: lot?.player.runs,
                wickets: lot?.player.wickets,
                average: lot?.player.average,
                strikeRate: lot?.player.strikeRate,
              }}
            />
          </div>
        </section>

        {/* ── Right Pillar: Trophy Showcase & Architectural Quotes ── */}
        <aside className="hidden lg:flex flex-col justify-between border-l border-white/10 pl-4 py-2">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.25em] text-white/40">
              OFFICIAL TROPHY
            </span>
            <span className="font-condensed text-xs font-black uppercase tracking-wider text-brand-yellow">
              BIGGER PLAYERS
              <br />
              BOLDER MOVES
            </span>
          </div>

          {/* Glass Trophy Pedestal */}
          <div className="relative my-auto flex flex-col items-center border border-white/15 bg-gradient-to-b from-white/[0.04] to-transparent p-3">
            <div className="relative h-44 w-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/landing/trophy/ipl-trophy.svg"
                alt="TATA IPL Trophy"
                className="h-40 w-auto object-contain drop-shadow-[0_0_20px_rgba(249,212,123,0.35)]"
              />
            </div>
            <span className="font-mono text-[8px] uppercase tracking-widest text-white/40 mt-1">
              TATA IPL TROPHY
            </span>
          </div>

          {/* Architectural Concrete Slogan */}
          <div className="py-4 border-t border-white/10">
            <span className="font-condensed text-[13px] font-black uppercase leading-tight tracking-wider text-white/25 block">
              TALENT
              <br />
              FUELS
              <br />
              TOMORROW
            </span>
          </div>
        </aside>
      </main>

      {/* Ticker / Running Sold Ledger */}
      {snapshot.soldLog.length > 0 && (
        <div className="shrink-0 overflow-hidden border-t border-white/10 bg-[#161616] py-2">
          <div className="anim-marquee flex w-max gap-12 whitespace-nowrap font-mono text-xs text-white">
            {[...snapshot.soldLog, ...snapshot.soldLog].map((s, i) => (
              <span key={`${s.id}-${i}`}>
                {s.playerName}
                <span className="mx-2 text-brand-yellow font-black tabular-nums">{formatMoney(s.price)}</span>
                <span className="text-brand-blue font-bold">[{s.teamShortCode}]</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Global Architectural Footer with 5-Color Swatch Strip */}
      <GlobalFooter
        tagline="MORE THAN A TOURNAMENT. A LEGACY IN MOTION."
        year="IPL AUCTION 2024"
      />

      {/* SOLD / UNSOLD Stamp Animation */}
      <AnimatePresence>{stamp && <SoldStamp key={stamp} kind={stamp} />}</AnimatePresence>
    </div>
  )
}
