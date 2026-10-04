'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { TeamCrest } from '@/components/ui/team-crest'
import { IplLogo } from '@/components/ui/ipl-logo'
import { GlobalFooter } from '@/components/ui/global-footer'
import { SoldCelebration } from '@/components/auction/sold-celebration'
import { LandingScene } from '@/components/ui/landing-scene'
import { ChevronLeft, ArrowRight, Menu } from 'lucide-react'

type Room = {
  id: string
  name: string
  phase: string
  round: number
  teams: {
    id: string
    name: string
    shortCode: string
    colorAccent: string
    logoUrl: string | null
  }[]
  _count: { players: number }
}

interface LandingExperienceProps {
  rooms: Room[]
  initialEntered?: boolean
}

// Ordered exactly as shown in the user's reference image:
// MI -> CSK -> RCB -> KKR -> RR -> DC -> SRH -> LSG -> PBKS -> GT
const BASE_CONVEYOR_TEAMS = [
  { shortCode: 'MI', name: 'Mumbai Indians', colorAccent: '#004BA0', logoUrl: '/logos/mi.svg' },
  { shortCode: 'CSK', name: 'Chennai Super Kings', colorAccent: '#F9CD05', logoUrl: '/logos/csk.svg' },
  { shortCode: 'RCB', name: 'Royal Challengers Bengaluru', colorAccent: '#EC1C24', logoUrl: '/logos/rcb.svg' },
  { shortCode: 'KKR', name: 'Kolkata Knight Riders', colorAccent: '#3A225D', logoUrl: '/logos/kkr.svg' },
  { shortCode: 'RR', name: 'Rajasthan Royals', colorAccent: '#EA1A85', logoUrl: '/logos/rr.svg' },
  { shortCode: 'DC', name: 'Delhi Capitals', colorAccent: '#17479E', logoUrl: '/logos/dc.svg' },
  { shortCode: 'SRH', name: 'Sunrisers Hyderabad', colorAccent: '#F26522', logoUrl: '/logos/srh.svg' },
  { shortCode: 'LSG', name: 'Lucknow Super Giants', colorAccent: '#A72056', logoUrl: '/logos/lsg.svg' },
  { shortCode: 'PBKS', name: 'Punjab Kings', colorAccent: '#ED1B24', logoUrl: '/logos/pbks.svg' },
  { shortCode: 'GT', name: 'Gujarat Titans', colorAccent: '#1C1C34', logoUrl: '/logos/gt.svg' },
]

export function LandingExperience({ rooms, initialEntered = false }: LandingExperienceProps) {
  // Navigation between Screen 1 (Landing Hero) and Screen 2 (Room Directory)
  const [hasEntered, setHasEntered] = useState(initialEntered)
  const [hoveredTeamKey, setHoveredTeamKey] = useState<string | null>(null)
  const [transitionCelebration, setTransitionCelebration] = useState(0)
  const [istTime, setIstTime] = useState('05:42:17 IST')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const formatted = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      setIstTime(`${formatted} IST`)
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Handle entering auction with dynamic bat swing transition animation
  const handleEnterAuction = () => {
    // 1. Trigger the celebratory cricketer bat swing animation
    setTransitionCelebration((c) => c + 1)
    // 2. Seamlessly transition between landing and rooms directory during the animation
    setTimeout(() => {
      setHasEntered(true)
      window.history.pushState(null, '', '/rooms')
    }, 850)
  }

  // Merge database team metadata (like id) with base conveyor items
  const conveyorTeams = useMemo(() => {
    const dbTeams = rooms[0]?.teams ?? []
    return BASE_CONVEYOR_TEAMS.map((base) => {
      const matched = dbTeams.find((t) => t.shortCode === base.shortCode)
      return {
        ...base,
        id: matched?.id || base.shortCode.toLowerCase(),
        logoUrl: matched?.logoUrl || base.logoUrl,
      }
    })
  }, [rooms])

  return (
    <div className="relative min-h-screen w-full bg-[#121212] text-white overflow-x-hidden select-none">
      {/* 
        ================================================================
        GLOBAL BRUTALIST ARCHITECTURAL BACKGROUND
        Contains:
        - Brutalist concrete architecture & beams
        - Natural sunlight & sky opening
        - 3 hanging banners (MI Blue, CSK Yellow, RCB Red)
        - IPL Trophy in glass display case on stone pedestal
        - Cricket sculpture on right wall
        - Concrete steps and tropical foliage
        ================================================================
      */}
      <LandingScene />

      {/* Content wrapper */}
      <div className="relative z-10 flex min-h-screen flex-col justify-between">
        <AnimatePresence mode="wait">
          {!hasEntered ? (
            /* 
              ============================================================
              SCREEN 1: LANDING PAGE (Exact Match to User Reference Screenshot)
              - Top-left: Official white IPL logo with batsman icon from Figma
              - Left hero:
                "INDIAN PREMIER LEAGUE"
                "IPL AUCTION" (Monumental Teko condensed bold typography)
                "BIGGER PLAYERS. BOLDER MOVES."
                "A NEW CHAPTER AWAITS. ——————"
              - Button: Glowing electric blue card:
                "ENTER THE AUCTION →"
                "MANAGE SQUADS  VIEW AUCTIONS LIVE  TRACK STRATEGY"
              - Subtext: "○—— ALL 10 TEAMS. ONE AUCTION."
              - Bottom bar:
                Left: "IPL AUCTION 2024"
                Center: 10 team crests in exact order (MI, CSK, RCB, KKR, RR, DC, SRH, LSG, PBKS, GT)
                Right: "CRICKET BUILDS BRIDGES" / "INDIA LIVES CRICKET"
              ============================================================
            */
            <motion.main
              key="landing-hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="flex-1 flex flex-col justify-between px-6 pt-6 pb-4 md:px-12 lg:px-16 min-h-screen"
            >
              {/* Header Navbar: Matches user reference screenshot exactly */}
              <div className="flex items-center justify-between w-full pt-2 select-none">
                {/* Left: Official IPL Brand Logo with authentic cricketer */}
                <div className="flex items-center gap-3">
                  <IplLogo size="md" showText={false} />
                </div>

                {/* Center: Navigation Links */}
                <nav className="hidden md:flex items-center gap-8 lg:gap-11">
                  {['AUCTION', 'TEAMS', 'PLAYERS', 'HISTORY', 'ABOUT'].map((item) => (
                    <span
                      key={item}
                      className="font-mono text-[11px] lg:text-xs font-semibold uppercase tracking-[0.25em] text-white/70 hover:text-white transition-colors cursor-pointer"
                    >
                      {item}
                    </span>
                  ))}
                </nav>

                {/* Right: Live Badge, Clock, Hamburger Menu */}
                <div className="flex items-center gap-4 sm:gap-6">
                  {/* Live Status Indicator */}
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    </span>
                    <span className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-widest text-white/90">
                      LIVE
                    </span>
                  </div>

                  {/* IST Time */}
                  <span className="font-mono text-[11px] sm:text-xs tracking-widest text-white/70">
                    {istTime}
                  </span>

                  {/* Mobile / Global Menu Hamburger */}
                  <button
                    type="button"
                    aria-label="Navigation Menu"
                    className="text-white/80 hover:text-white transition-colors p-1 cursor-pointer"
                  >
                    <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              {/* Main Left Hero Area: Exact match to user reference screenshot */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 items-center my-auto py-2">
                <div className="relative z-20 flex flex-col max-w-[620px] sm:max-w-[680px] lg:max-w-[760px] xl:max-w-[820px] py-1 select-none">
                  {/* Category Eyebrow */}
                  <span className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-[0.35em] text-white/75 mb-1.5 block">
                    INDIAN PREMIER LEAGUE
                  </span>

                  {/* Monumental Headline: "IPL" with side tags, followed by "AUCTION" */}
                  <div className="flex flex-col select-none">
                    <div className="flex items-center gap-6 sm:gap-8">
                      <h1 className="font-teko text-[7rem] sm:text-[8.5rem] md:text-[10rem] lg:text-[11.5rem] font-bold uppercase tracking-tight text-white leading-[0.76] drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
                        IPL
                      </h1>
                      {/* Vertical Category Pillar from Reference Image */}
                      <div className="flex flex-col gap-1.5 font-mono text-[9px] sm:text-[10px] tracking-[0.28em] text-white/50 uppercase border-l border-white/15 pl-4 sm:pl-5 py-1 self-center">
                        <span>PLAYERS</span>
                        <span>FRANCHISES</span>
                        <span>STRATEGY</span>
                        <span>RIVALRY</span>
                        <span>LEGACY</span>
                      </div>
                    </div>

                    <h2 className="font-teko text-[7rem] sm:text-[8.5rem] md:text-[10rem] lg:text-[11.5rem] font-bold uppercase tracking-tight text-white leading-[0.76] drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
                      AUCTION
                    </h2>
                  </div>

                  {/* Editorial Tagline with trailing hairline */}
                  <div className="mt-4 sm:mt-5 flex flex-col gap-1 font-mono text-[11px] sm:text-xs tracking-[0.2em] text-white/75 uppercase">
                    <span>BIGGER PLAYERS. BOLDER MOVES.</span>
                    <span className="flex items-center gap-2">
                      A NEW CHAPTER AWAITS.
                      <span className="inline-block w-20 sm:w-28 h-[1px] bg-white/30" />
                    </span>
                  </div>

                  {/* Single Action Button: ENTER THE AUCTION matching reference card colorscheme & layout */}
                  <div className="mt-7 sm:mt-8">
                    <button
                      type="button"
                      data-testid="enter-auction-btn"
                      aria-label="Enter the Auction"
                      onClick={handleEnterAuction}
                      className="group flex flex-col justify-between w-full max-w-[280px] sm:max-w-[320px] rounded-none border border-[#2563EB]/80 hover:border-blue-400 bg-[#0B2564]/85 hover:bg-[#0E3184]/95 p-5 sm:p-6 text-left shadow-[0_0_30px_rgba(37,99,235,0.45)] hover:shadow-[0_0_50px_rgba(37,99,235,0.75)] backdrop-blur-md transition-all duration-300 active:scale-[0.99] cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-[#60A5FA]">
                          ENTER THE
                        </span>
                        <ArrowRight className="w-5 h-5 text-[#60A5FA] group-hover:text-white group-hover:translate-x-1.5 transition-all" />
                      </div>

                      <span className="font-teko text-5xl sm:text-6xl font-bold uppercase tracking-wide text-white leading-none my-1.5 block">
                        AUCTION
                      </span>

                      <div className="font-mono text-[9.5px] sm:text-[10px] uppercase tracking-[0.16em] text-white/75 flex flex-col gap-0.5 leading-snug mt-1">
                        <span>MANAGE YOUR SQUAD</span>
                        <span>VIEW AUCTIONS LIVE</span>
                        <span>TRACK YOUR STRATEGY</span>
                      </div>
                    </button>

                    {/* Sub-tagline below button */}
                    <div className="mt-5 flex items-center gap-2 font-mono text-xs tracking-[0.24em] text-white/60 uppercase">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border border-white/50 inline-block" />
                        <span className="w-6 h-[1px] bg-white/40 inline-block" />
                      </span>
                      <span>ALL 10 TEAMS. ONE AUCTION.</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Kept clear to show sunlight courtyard, MI/CSK/RCB banners & Trophy */}
                <div className="hidden lg:block min-h-[460px] w-full pointer-events-none" />
              </div>

              {/* 
                ============================================================
                BOTTOM BAR (Exact Match to User Reference Screenshot)
                - Left: "IPL AUCTION 2024"
                - Center: 10 team crests in exact order (MI, CSK, RCB, KKR, RR, DC, SRH, LSG, PBKS, GT)
                - Right: "CRICKET BUILDS BRIDGES" / "INDIA LIVES CRICKET"
                ============================================================
              */}
              <div className="relative z-20 mt-auto pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 select-none">
                {/* Left: Year & Label */}
                <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-white/60">
                  IPL AUCTION 2024
                </span>

                {/* Center: 10 Team Crests in Exact Order */}
                <div className="flex items-center gap-5 sm:gap-7 md:gap-9 overflow-x-auto py-1 px-2">
                  {conveyorTeams.map((team) => {
                    const uniqueKey = team.shortCode
                    const isHovered = hoveredTeamKey === uniqueKey

                    return (
                      <div
                        key={uniqueKey}
                        onMouseEnter={() => setHoveredTeamKey(uniqueKey)}
                        onMouseLeave={() => setHoveredTeamKey(null)}
                        onClick={() => {
                          if (rooms[0]) {
                            window.location.href = `/team/${rooms[0].id}/${team.id}`
                          }
                        }}
                        className="relative cursor-pointer flex-shrink-0 flex items-center justify-center group"
                        title={team.name}
                      >
                        {/* Floating Team Name Tooltip */}
                        {isHovered && (
                          <div
                            className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded border font-bebas text-xs tracking-wider whitespace-nowrap shadow-2xl pointer-events-none z-30"
                            style={{
                              backgroundColor: 'rgba(10, 10, 10, 0.95)',
                              borderColor: team.colorAccent,
                              color: team.colorAccent,
                              boxShadow: `0 0 16px ${team.colorAccent}80`,
                            }}
                          >
                            {team.name}
                          </div>
                        )}

                        {/* Monochrome silver-white vector icon that illuminates in color on hover */}
                        <div className="relative h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={team.logoUrl}
                            alt={team.name}
                            className="h-full w-full object-contain transition-all duration-300 ease-out"
                            style={{
                              filter: isHovered
                                ? `drop-shadow(0 0 14px ${team.colorAccent}) drop-shadow(0 0 4px ${team.colorAccent})`
                                : 'grayscale(100%) brightness(1.6) contrast(1.1) drop-shadow(0 2px 6px rgba(0,0,0,0.8))',
                              opacity: isHovered ? 1 : 0.65,
                              transform: isHovered ? 'scale(1.2) translateY(-2px)' : 'scale(1)',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Right: Slogan block */}
                <div className="flex flex-col items-end text-right">
                  <div className="font-mono text-[8.5px] font-bold uppercase leading-tight tracking-[0.2em] text-white/60">
                    <span>CRICKET</span>
                    <br />
                    <span>BUILDS</span>
                    <br />
                    <span>BRIDGES</span>
                  </div>
                  <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-white/40 mt-1">
                    INDIA LIVES CRICKET
                  </span>
                </div>
              </div>
            </motion.main>
          ) : (
            /* 
              ============================================================
              SCREEN 2: ROOM DIRECTORY (Format matched to auction.mlritcie.in/rooms)
              - Back navigation: RETURN TO ENTRANCE
              - Header: "Choose your seat" / "Auction Rooms"
              - Room Sections: 01, 02 with Admin Console, Big Screen, and 10 Team Seats
              - Team cards with bottom accent border
              ============================================================
            */
            <motion.main
              key="room-directory"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35 }}
              className="flex-1 flex flex-col justify-start px-6 py-8 md:px-12 lg:px-16 min-h-screen"
            >
              <div className="max-w-6xl w-full mx-auto">
                {/* Navigation Bar */}
                <div className="mb-6 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setHasEntered(false)
                      window.history.pushState(null, '', '/')
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 font-sans text-xs font-medium text-white/80 backdrop-blur transition hover:border-white/30 hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>RETURN TO ENTRANCE</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <IplLogo size="sm" />
                  </div>
                </div>

                {/* Header matching mlritcie format */}
                <header className="mb-8 border-b border-white/10 pb-6">
                  <p className="font-mono text-xs uppercase tracking-[0.32em] text-brand-yellow">
                    Choose your seat
                  </p>
                  <h1 className="mt-2 font-condensed text-4xl sm:text-5xl font-black uppercase tracking-tight text-white">
                    Auction Rooms
                  </h1>
                  <p className="mt-2 max-w-2xl font-sans text-sm text-white/60">
                    Spectate the live lot on the big screen, run the hammer from the admin console, or
                    take a franchise desk with your four-digit PIN.
                  </p>
                </header>

                {/* Room Cards Grid */}
                <div className="flex flex-col gap-10">
                  {rooms.map((room, roomIndex) => (
                    <section
                      key={room.id}
                      className="rounded-2xl border border-white/10 bg-[#161619]/90 p-6 backdrop-blur-md shadow-2xl transition duration-300 hover:border-white/20"
                    >
                      {/* Room Header */}
                      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-4">
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono text-sm font-bold text-white/40">
                            {String(roomIndex + 1).padStart(2, '0')}
                          </span>
                          <h2 className="font-condensed text-3xl font-black uppercase text-white">
                            {room.name}
                          </h2>
                          <span className="rounded bg-brand-yellow/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-yellow">
                            {room.phase}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-white/50">
                          {room._count.players} players remaining
                        </div>
                      </div>

                      {/* Primary Actions: Display Board & Admin Console */}
                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Link
                          href={`/display/${room.id}`}
                          className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.04] p-4 transition duration-200 hover:border-brand-blue/50 hover:bg-brand-blue/10"
                        >
                          <div>
                            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-brand-blue">
                              Broadcast
                            </span>
                            <div className="font-condensed text-xl font-bold uppercase text-white">
                              Big Screen Display
                            </div>
                            <p className="font-sans text-xs text-white/50">
                              Center-stage view of the lot, bids, and hammer timer.
                            </p>
                          </div>
                          <span className="font-mono text-lg text-white/40">↗</span>
                        </Link>

                        <Link
                          href={`/admin/${room.id}`}
                          className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.04] p-4 transition duration-200 hover:border-brand-yellow/50 hover:bg-brand-yellow/10"
                        >
                          <div>
                            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-brand-yellow">
                              Restricted
                            </span>
                            <div className="font-condensed text-xl font-bold uppercase text-white">
                              Admin Console
                            </div>
                            <p className="font-sans text-xs text-white/50">
                              Load lots, advance round, call sold/unsold, pause timer.
                            </p>
                          </div>
                          <span className="font-mono text-lg text-white/40">↗</span>
                        </Link>
                      </div>

                      {/* Team Seats Header */}
                      <h3 className="mt-6 font-mono text-[10px] uppercase tracking-[0.32em] text-white/40">
                        Team seats
                      </h3>

                      {/* 10-Team Grid */}
                      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {room.teams.map((t) => (
                          <li key={t.id}>
                            <Link
                              href={`/team/${room.id}/${t.id}`}
                              className="group/seat flex h-full flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-4 text-center transition duration-300 hover:-translate-y-1 hover:border-white/30 hover:bg-white/[0.06]"
                              style={{ boxShadow: `inset 0 -3px 0 0 ${t.colorAccent}` }}
                              title={`Enter ${t.name} seat (Room PIN required)`}
                            >
                              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-sm group-hover/seat:scale-105 transition-transform">
                                <TeamCrest
                                  shortCode={t.shortCode}
                                  name={t.name}
                                  colorAccent={t.colorAccent}
                                  logoUrl={t.logoUrl}
                                  mark
                                  className="h-9 w-9 object-contain"
                                />
                              </span>
                              <span className="font-sans text-xs font-medium leading-tight text-white/80 group-hover/seat:text-white">
                                {t.name}
                              </span>
                              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">
                                {t.shortCode}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>

                {/* Directory Footer */}
                <GlobalFooter
                  tagline="MORE THAN A TOURNAMENT. A LEGACY IN MOTION."
                  year="IPL AUCTION 2024"
                />
              </div>
            </motion.main>
          )}
        </AnimatePresence>
      </div>

      {/* Cricketer Bat Swing Celebration Animation on Enter / Transition */}
      <SoldCelebration trigger={transitionCelebration} />
    </div>
  )
}
