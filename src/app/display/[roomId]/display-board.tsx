'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Shield,
  Award,
  Users,
  Tv,
  ArrowRight,
} from 'lucide-react'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { useLotEntrance } from '@/hooks/use-lot-entrance'
import { SoldStamp } from '@/components/ui/sold-stamp'
import { Model3D } from '@/components/ui/model-3d'
import { GlobalHeader } from '@/components/ui/global-header'
import { GlobalFooter } from '@/components/ui/global-footer'
import { BiddingLogTable } from '@/components/auction/bidding-log-table'
import { TeamCrest } from '@/components/ui/team-crest'
import { SoldCelebration } from '@/components/auction/sold-celebration'
import { ResultsTicker } from '@/components/auction/results-ticker'
import {
  getPublicSnapshot,
  type PublicSnapshot,
  type RoomPlayerItem,
} from '@/app/admin/[roomId]/actions'
import { formatMoney } from '@/lib/money'

type CategoryFilter = 'LIVE' | 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER'

interface PerformanceGraphProps {
  stats: {
    matches?: number | null
    runs?: number | null
    wickets?: number | null
    average?: number | null
    strikeRate?: number | null
  }
}

function PerformanceGraph({ stats }: PerformanceGraphProps) {
  const m = stats.matches ?? 0
  const r = stats.runs ?? 0
  const w = stats.wickets ?? 0
  const avg = stats.average ?? 0
  const sr = stats.strikeRate ?? 0

  const mHeight = m > 0 ? Math.min(95, Math.max(12, Math.round((m / 350) * 90))) : 8
  const rHeight = r > 0 ? Math.min(95, Math.max(12, Math.round((r / 8000) * 90))) : 8
  const wHeight = w > 0 ? Math.min(95, Math.max(12, Math.round((w / 180) * 90))) : 8
  const avgHeight = avg > 0 ? Math.min(95, Math.max(12, Math.round((avg / 55) * 90))) : 8
  const srHeight = sr > 0 ? Math.min(95, Math.max(12, Math.round((sr / 180) * 90))) : 8

  const items = [
    { label: 'M', value: m, height: mHeight, color: 'bg-[#2074D5]' },
    { label: 'R', value: r, height: rHeight, color: 'bg-[#F9D47B]' },
    { label: 'W', value: w, height: wHeight, color: 'bg-[#EB547C]' },
    { label: 'AVG', value: avg, height: avgHeight, color: 'bg-white' },
    { label: 'SR', value: sr, height: srHeight, color: 'bg-[#2074D5]' },
  ]

  return (
    <div className="flex h-full flex-col justify-between border border-white/10 bg-[#161619] p-3">
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/50 block mb-1">
        PERFORMANCE GRAPH
      </span>

      <div className="flex flex-1 items-end justify-between gap-2 px-1 pb-1 pt-2">
        {items.map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end group">
            <span className="font-mono text-[8px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
              {item.value}
            </span>
            <div className="w-full max-w-[22px] bg-white/5 flex items-end h-24 border-b border-white/15">
              <div
                className={`w-full ${item.color} transition-all duration-500 rounded-none shadow-[0_0_6px_rgba(255,255,255,0.1)]`}
                style={{ height: `${item.height}%` }}
              />
            </div>
            <span className="font-mono text-[9px] font-extrabold uppercase tracking-wider text-white/70">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

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

  // Category switcher state
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('LIVE')
  const [selectedPlayer, setSelectedPlayer] = useState<RoomPlayerItem | null>(null)
  const [expandedCricketer, setExpandedCricketer] = useState<RoomPlayerItem | NonNullable<PublicSnapshot['currentLot']>['player'] | null>(null)
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const [soldTrigger, setSoldTrigger] = useState<number>(0)
  const lastLotStatusRef = useRef(initialSnapshot.currentLot?.status)

  const { snapshot } = useLiveSnapshot(roomId, initialSnapshot, getPublicSnapshot, (event) => {
    if (event.type === 'BID') {
      setBidPulse(true)
      clearTimeout(pulseTimer.current)
      pulseTimer.current = setTimeout(() => setBidPulse(false), 1400)
      return
    }
    if (event.type === 'SOLD') {
      setSoldTrigger((t) => t + 1)
    }
    if (event.type !== 'SOLD' && event.type !== 'UNSOLD') return
    setStamp(event.type)
    clearTimeout(stampTimer.current)
    stampTimer.current = setTimeout(() => setStamp(null), 4000)
  })

  // Also trigger if snapshot lot transitions to SOLD (e.g. initial re-fetch or socket catchup)
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

  // Filter players by category
  const filteredPlayers = React.useMemo(() => {
    if (selectedCategory === 'LIVE') return []
    return roomPlayers.filter((p) => {
      const r = p.role.toUpperCase()
      if (selectedCategory === 'BATTER') return r.includes('BAT')
      if (selectedCategory === 'BOWLER') return r.includes('BOWL')
      if (selectedCategory === 'ALL_ROUNDER') return r.includes('ALL')
      if (selectedCategory === 'WICKET_KEEPER') return r.includes('WICKET') || r === 'WK'
      return false
    })
  }, [roomPlayers, selectedCategory])

  // Current featured player (either from selected category or live lot)
  const activeDisplayPlayer = selectedCategory !== 'LIVE' && selectedPlayer ? selectedPlayer : lot?.player ?? null

  const displayRole = (activeDisplayPlayer?.role || 'BATTER').replace('_', ' ').toUpperCase()
  const displayPhoto = activeDisplayPlayer?.photoUrl || null

  return (
    <div className="relative flex min-h-screen w-full flex-col pb-16 text-white overflow-x-hidden">
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
      <GlobalHeader
        activeTab="auction"
        roomId={roomId}
        roomName={snapshot.room.name || 'ROOM 1'}
        round={snapshot.room.round || 1}
        liveBeacon={true}
        location="CHENNAI, INDIA"
      />

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
            ROUND {snapshot.room.round || 1} • {roomPlayers.length > 0 ? roomPlayers.filter((p) => p.status === 'UPCOMING').length : 253} PLAYERS LEFT
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedCategory !== 'LIVE' && (
            <button
              onClick={() => {
                setSelectedCategory('LIVE')
                setSelectedPlayer(null)
              }}
              className="flex items-center gap-1.5 bg-[#EB547C] hover:bg-pink-600 px-3 py-1 font-condensed text-xs font-black uppercase tracking-wider text-white shadow transition-all cursor-pointer"
            >
              <Tv className="h-3 w-3" />
              <span>RETURN TO LIVE LOT</span>
            </button>
          )}
          <button
            onClick={() => setShowTeamPicker(true)}
            className="flex items-center gap-1.5 border border-white/20 bg-white/10 hover:bg-white/20 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
          >
            <Users className="h-3.5 w-3.5 text-brand-yellow" />
            <span>FRANCHISE SEATS</span>
          </button>
        </div>
      </div>

      {/* Main Composition: Left Pillar | Center Stage */}
      <main className="relative z-10 grid flex-1 grid-cols-1 lg:grid-cols-[160px_1fr] xl:grid-cols-[180px_1fr] gap-4 p-4 lg:px-6 min-h-0">
        {/* ── Left Pillar: Lot Number & Functional Category Navigation ── */}
        <aside className="flex flex-col justify-between border-r border-white/10 pr-4 py-2">
          <div className="flex flex-col gap-5">
            {/* LOT X / 577 */}
            <div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 block">
                LOT
              </span>
              <div className="font-condensed text-3xl font-black text-white tracking-tight mt-0.5">
                {lot ? lot.lotNumber : '1'}{' '}
                <span className="text-white/30 text-xl font-normal">/ {roomPlayers.length || 254}</span>
              </div>
            </div>

            {/* CATEGORY SELECTOR LIST (Interactive Category Switcher) */}
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 block">
                CATEGORY
              </span>

              <nav className="flex flex-col gap-1.5 font-mono text-[11px] font-bold tracking-wider">
                {/* LIVE LOT BUTTON */}
                <button
                  onClick={() => {
                    setSelectedCategory('LIVE')
                    setSelectedPlayer(null)
                  }}
                  className={`flex items-center justify-between text-left py-1.5 px-2 transition-all cursor-pointer ${
                    selectedCategory === 'LIVE'
                      ? 'border-l-2 border-[#EB547C] bg-white/10 text-white font-extrabold shadow'
                      : 'border-l-2 border-transparent text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>LIVE LOT</span>
                  {selectedCategory === 'LIVE' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#EB547C] animate-ping" />
                  )}
                </button>

                {/* BATSMAN */}
                <button
                  onClick={() => {
                    setSelectedCategory('BATTER')
                    const first = roomPlayers.find((p) => p.role.toUpperCase().includes('BAT'))
                    setSelectedPlayer(first || null)
                  }}
                  className={`flex items-center justify-between text-left py-1.5 px-2 transition-all cursor-pointer ${
                    selectedCategory === 'BATTER'
                      ? 'border-l-2 border-[#2074D5] bg-white/10 text-white font-extrabold shadow'
                      : 'border-l-2 border-transparent text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>BATSMAN</span>
                  <span className="font-mono text-[9px] text-white/40">
                    {roomPlayers.filter((p) => p.role.toUpperCase().includes('BAT')).length || 48}
                  </span>
                </button>

                {/* BOWLER */}
                <button
                  onClick={() => {
                    setSelectedCategory('BOWLER')
                    const first = roomPlayers.find((p) => p.role.toUpperCase().includes('BOWL'))
                    setSelectedPlayer(first || null)
                  }}
                  className={`flex items-center justify-between text-left py-1.5 px-2 transition-all cursor-pointer ${
                    selectedCategory === 'BOWLER'
                      ? 'border-l-2 border-[#2074D5] bg-white/10 text-white font-extrabold shadow'
                      : 'border-l-2 border-transparent text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>BOWLER</span>
                  <span className="font-mono text-[9px] text-white/40">
                    {roomPlayers.filter((p) => p.role.toUpperCase().includes('BOWL')).length || 52}
                  </span>
                </button>

                {/* ALL-ROUNDER */}
                <button
                  onClick={() => {
                    setSelectedCategory('ALL_ROUNDER')
                    const first = roomPlayers.find((p) => p.role.toUpperCase().includes('ALL'))
                    setSelectedPlayer(first || null)
                  }}
                  className={`flex items-center justify-between text-left py-1.5 px-2 transition-all cursor-pointer ${
                    selectedCategory === 'ALL_ROUNDER'
                      ? 'border-l-2 border-[#2074D5] bg-white/10 text-white font-extrabold shadow'
                      : 'border-l-2 border-transparent text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>ALL-ROUNDER</span>
                  <span className="font-mono text-[9px] text-white/40">
                    {roomPlayers.filter((p) => p.role.toUpperCase().includes('ALL')).length || 38}
                  </span>
                </button>

                {/* WICKETKEEPER */}
                <button
                  onClick={() => {
                    setSelectedCategory('WICKET_KEEPER')
                    const first = roomPlayers.find(
                      (p) => p.role.toUpperCase().includes('WICKET') || p.role.toUpperCase() === 'WK'
                    )
                    setSelectedPlayer(first || null)
                  }}
                  className={`flex items-center justify-between text-left py-1.5 px-2 transition-all cursor-pointer ${
                    selectedCategory === 'WICKET_KEEPER'
                      ? 'border-l-2 border-[#2074D5] bg-white/10 text-white font-extrabold shadow'
                      : 'border-l-2 border-transparent text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>WICKETKEEPER</span>
                  <span className="font-mono text-[9px] text-white/40">
                    {roomPlayers.filter((p) => p.role.toUpperCase().includes('WICKET') || p.role.toUpperCase() === 'WK').length || 20}
                  </span>
                </button>
              </nav>
            </div>

            {/* Quick Category Player Switcher strip */}
            {selectedCategory !== 'LIVE' && filteredPlayers.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-white/10 pt-3">
                <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/40">
                  {selectedCategory.replace('_', ' ')} ROSTER ({filteredPlayers.length})
                </span>
                <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto pr-1">
                  {filteredPlayers.slice(0, 15).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlayer(p)}
                      className={`flex items-center justify-between text-left px-2 py-1 border text-[10px] font-condensed uppercase tracking-wider transition-all cursor-pointer ${
                        selectedPlayer?.id === p.id
                          ? 'border-brand-yellow bg-brand-yellow/15 text-white font-black'
                          : 'border-white/10 bg-black/20 text-white/60 hover:text-white hover:border-white/30'
                      }`}
                    >
                      <span className="truncate max-w-[95px]">{p.name}</span>
                      <span className="font-mono text-[8px] text-brand-yellow tabular-nums">
                        {formatMoney(p.basePrice)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
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

        {/* ── Center Stage: Player Hero + Action Controls + Bottom Panels (Screenshot 2) ── */}
        <section className="flex flex-col gap-3 min-w-0">
          {/* Active / Selected Player Card matching Screenshot 2 */}
          <div
            ref={cardRef}
            className={`flex flex-col border border-white/10 bg-[#161619]/90 p-4 text-white shadow-2xl backdrop-blur-md ${
              bidPulse ? 'anim-bid-pop' : ''
            }`}
          >
            {/* Category Browser Banner if browsing category */}
            {selectedCategory !== 'LIVE' && (
              <div className="flex items-center justify-between bg-[#2074D5]/20 border border-[#2074D5]/40 px-3 py-1.5 mb-3 text-xs">
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#2074D5]">
                  BROWSING {selectedCategory.replace('_', ' ')} CATEGORY
                </span>
                <span className="font-mono text-[10px] text-white/60">
                  {filteredPlayers.findIndex((p) => p.id === selectedPlayer?.id) + 1} of {filteredPlayers.length}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center">
              {/* Framed Player Portrait with Yellow Corner Accents & Expand Trigger */}
              <div
                onClick={() => setExpandedCricketer(activeDisplayPlayer)}
                className="group relative aspect-[4/5] w-full max-w-[200px] mx-auto md:mx-0 overflow-hidden bg-[#202020] border border-white/15 cursor-pointer shadow-lg"
                title="Click to expand player stats"
              >
                {/* Yellow Corner Bracket Accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-brand-yellow z-10" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-brand-yellow z-10" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-brand-yellow z-10" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-brand-yellow z-10" />

                {!activeDisplayPlayer ? (
                  <Model3D src="/models/trophy.glb" loop className="h-full w-full" />
                ) : displayPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayPhoto}
                    alt={activeDisplayPlayer?.name || 'Player'}
                    className="h-full w-full object-cover object-top filter contrast-[1.05] transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-condensed text-5xl font-black text-white/20">
                    {activeDisplayPlayer?.name
                      ? activeDisplayPlayer.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                      : 'IPL'}
                  </div>
                )}

                {/* Hover overlay hint to expand */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 font-mono text-xs font-bold text-brand-yellow">
                  <Maximize2 className="h-4 w-4" />
                  <span>EXPAND</span>
                </div>
              </div>

              {/* Right: Player Name Banner & Sub-Layout */}
              <div className="flex flex-col justify-between h-full gap-3">
                {/* Header Blue Banner matching Screenshot 2 */}
                <div className="bg-[#2074D5] px-4 py-2.5 shadow-md flex items-center justify-between">
                  <div>
                    <h1 className="font-condensed text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-none">
                      {activeDisplayPlayer?.name || 'AWAITING NEXT LOT'}
                    </h1>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-white/85">
                      <span>
                        {activeDisplayPlayer?.setNumber || 'SET 1'} • {displayRole}
                      </span>
                      {activeDisplayPlayer && (
                        <>
                          <span
                            className={`border-2 border-brand-charcoal px-2 py-0.5 font-condensed text-sm font-black tracking-widest text-brand-charcoal shadow-[2px_2px_0_#282828] ${
                              activeDisplayPlayer.isOverseas ? 'bg-brand-yellow' : 'bg-brand-white'
                            }`}
                          >
                            {activeDisplayPlayer.isOverseas ? 'OVERSEAS' : 'INDIAN'}
                          </span>
                          <span className="text-[9px] font-medium normal-case text-white/60">
                            {activeDisplayPlayer.nationality}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedCricketer(activeDisplayPlayer)}
                    className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-1 text-white font-mono text-[9px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    <Maximize2 className="h-3 w-3" />
                    <span className="hidden sm:inline">FULL STATS</span>
                  </button>
                </div>

                {/* Sub-Layout: CURRENT BID & 2x2 Grid | PERFORMANCE GRAPH */}
                <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1fr] gap-3">
                  {/* Left: CURRENT BID Plate (Pink) & 2x2 Info Grid */}
                  <div className="flex flex-col justify-between gap-2.5">
                    {/* CURRENT BID Plate */}
                    <div className="bg-[#EB547C] p-3 text-white shadow-[0_0_20px_rgba(235,84,124,0.3)]">
                      <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/85 block">
                        {selectedCategory === 'LIVE' ? 'CURRENT BID' : 'VALUATION BASE'}
                      </span>
                      <div className="font-condensed text-3xl sm:text-4xl font-black leading-none tracking-tight text-white mt-1 tabular-nums">
                        {selectedCategory === 'LIVE' && lot
                          ? formatMoney(lot.currentBid)
                          : activeDisplayPlayer
                          ? formatMoney(activeDisplayPlayer.basePrice)
                          : '—'}
                      </div>
                    </div>

                    {/* 2x2 Info Grid: TEAM | ROLE | BASE | STATUS */}
                    <div className="grid grid-cols-2 gap-px bg-white/15 border border-white/15">
                      {/* TEAM */}
                      <div className="bg-[#17171A] p-2">
                        <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                          HIGHEST BIDDER
                        </span>
                        <span className="font-condensed text-xs sm:text-sm font-black uppercase text-white truncate block mt-0.5">
                          {leader ? leader.name : 'Waiting for bid'}
                        </span>
                      </div>

                      {/* ROLE */}
                      <div className="bg-[#17171A] p-2">
                        <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                          ROLE
                        </span>
                        <span className="font-condensed text-xs sm:text-sm font-black uppercase text-white truncate block mt-0.5">
                          {displayRole}
                        </span>
                      </div>

                      {/* BASE */}
                      <div className="bg-[#17171A] p-2">
                        <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                          BASE PRICE
                        </span>
                        <span className="font-condensed text-xs sm:text-sm font-black uppercase text-brand-yellow truncate block mt-0.5 tabular-nums">
                          {activeDisplayPlayer ? formatMoney(activeDisplayPlayer.basePrice) : '—'}
                        </span>
                      </div>

                      {/* CAPS */}
                      <div className="bg-[#17171A] p-2">
                        <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                          T20 CAPS
                        </span>
                        <span className="font-condensed text-xs sm:text-sm font-black uppercase text-white truncate block mt-0.5 tabular-nums">
                          {activeDisplayPlayer?.matches ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: PERFORMANCE GRAPH with M, R, W, AVG, SR */}
                  <div className="h-full min-h-[140px]">
                    <PerformanceGraph
                      stats={{
                        matches: activeDisplayPlayer?.matches,
                        runs: activeDisplayPlayer?.runs,
                        wickets: activeDisplayPlayer?.wickets,
                        average: activeDisplayPlayer?.average,
                        strikeRate: activeDisplayPlayer?.strikeRate,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Strip: CURRENT BID (Yellow) */}
          <div className="grid grid-cols-1 gap-4">
            {/* CURRENT BID - Monumental Yellow Plate */}
            <div className="flex flex-col justify-between border border-brand-yellow bg-brand-yellow p-4 text-[#282828] shadow-[0_0_20px_rgba(249,212,123,0.25)]">
              <div>
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#282828]/80 block">
                  ACTIVE FLOOR BID
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
                    <span>OPENING FLOOR</span>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Row: Bidding Log */}
          <div className="grid grid-cols-1 gap-4">
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
          </div>
        </section>
      </main>

      {/* News-channel results ticker, pinned to the bottom */}
      <ResultsTicker results={snapshot.resultLog} />

      {/* Global Architectural Footer */}
      <GlobalFooter
        tagline="MORE THAN A TOURNAMENT. A LEGACY IN MOTION."
        year="IPL AUCTION 2024"
      />

      {/* SOLD / UNSOLD Stamp Animation */}
      <AnimatePresence>{stamp && <SoldStamp key={stamp} kind={stamp} />}</AnimatePresence>

      {/* Team Seat Picker Modal */}
      <AnimatePresence>
        {showTeamPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xl border border-white/20 bg-[#141417] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-4">
                <div>
                  <h3 className="font-condensed text-2xl font-black uppercase text-white">
                    SELECT FRANCHISE SEAT
                  </h3>
                  <p className="font-mono text-xs text-white/50">
                    Enter the war room console to place official bids
                  </p>
                </div>
                <button
                  onClick={() => setShowTeamPicker(false)}
                  className="p-1 text-white/60 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                {snapshot.teams.map((t) => (
                  <Link
                    key={t.id}
                    href={`/team/${roomId}/${t.id}`}
                    onClick={() => setShowTeamPicker(false)}
                    className="flex items-center justify-between border border-white/10 bg-[#1C1C20] p-3 hover:border-white/30 hover:bg-[#24242A] transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <TeamCrest
                        shortCode={t.shortCode}
                        name={t.name}
                        colorAccent={t.colorAccent}
                        logoUrl={t.logoUrl}
                        mark
                        className="h-6 w-6"
                      />
                      <div>
                        <span className="font-condensed text-base font-bold uppercase text-white block group-hover:text-brand-yellow">
                          {t.shortCode}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-white transition-transform group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Expandable Cricketer Full-Screen Modal */}
      <AnimatePresence>
        {expandedCricketer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-lg">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl border border-white/20 bg-[#141417] p-6 shadow-2xl text-white"
            >
              <button
                onClick={() => setExpandedCricketer(null)}
                className="absolute top-4 right-4 p-2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                <div className="relative aspect-[3/4] w-48 shrink-0 overflow-hidden border-2 border-brand-yellow bg-black shadow-xl">
                  {expandedCricketer.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={expandedCricketer.photoUrl}
                      alt={expandedCricketer.name}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-condensed text-5xl font-black text-white/20">
                      {expandedCricketer.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {expandedCricketer.isOverseas && (
                    <div className="absolute top-2 right-2 bg-[#2074D5] text-white font-mono text-[9px] font-black px-2 py-0.5 uppercase">
                      OVERSEAS
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col gap-4">
                  <div>
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-brand-yellow">
                      {expandedCricketer.setNumber || 'AUCTION POOL'} • {expandedCricketer.nationality}
                    </span>
                    <h2 className="font-condensed text-3xl sm:text-4xl font-black uppercase tracking-tight text-white mt-0.5">
                      {expandedCricketer.name}
                    </h2>
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-white/60 mt-1">
                      {expandedCricketer.role.replace('_', ' ')}
                    </p>
                  </div>

                  {/* 6 Technical Metric Tiles */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        BASE PRICE
                      </span>
                      <span className="font-condensed text-lg font-black text-brand-yellow tabular-nums">
                        {formatMoney(expandedCricketer.basePrice)}
                      </span>
                    </div>

                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        MATCHES
                      </span>
                      <span className="font-condensed text-lg font-black text-white tabular-nums">
                        {expandedCricketer.matches ?? 0}
                      </span>
                    </div>

                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        RUNS
                      </span>
                      <span className="font-condensed text-lg font-black text-white tabular-nums">
                        {expandedCricketer.runs ?? 0}
                      </span>
                    </div>

                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        WICKETS
                      </span>
                      <span className="font-condensed text-lg font-black text-white tabular-nums">
                        {expandedCricketer.wickets ?? 0}
                      </span>
                    </div>

                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        AVERAGE
                      </span>
                      <span className="font-condensed text-lg font-black text-white tabular-nums">
                        {expandedCricketer.average ? expandedCricketer.average.toFixed(1) : '—'}
                      </span>
                    </div>

                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        STRIKE RATE
                      </span>
                      <span className="font-condensed text-lg font-black text-brand-blue tabular-nums">
                        {expandedCricketer.strikeRate ? expandedCricketer.strikeRate.toFixed(1) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Performance Chart Component */}
                  <div className="h-32 border border-white/10">
                    <PerformanceGraph
                      stats={{
                        matches: expandedCricketer.matches,
                        runs: expandedCricketer.runs,
                        wickets: expandedCricketer.wickets,
                        average: expandedCricketer.average,
                        strikeRate: expandedCricketer.strikeRate,
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
