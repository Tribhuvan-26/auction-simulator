'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { GlobalHeader } from '@/components/ui/global-header'
import { GlobalFooter } from '@/components/ui/global-footer'
import { TeamCrest } from '@/components/ui/team-crest'
import { ArrowRight, Shield, Users, Tv, ChevronLeft, Layers, Sparkles } from 'lucide-react'

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

export function LandingExperience({ rooms }: { rooms: Room[] }) {
  // Gate: Landing Page (First Screen) -> Home Page (Main Screen)
  const [hasEntered, setHasEntered] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<'main' | 'roles'>('main')
  const [selectedRoleTab, setSelectedRoleTab] = useState<'all' | 'team' | 'admin'>('all')
  const [activeRoomId, setActiveRoomId] = useState<string>(rooms[0]?.id || '')

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0]

  const franchiseLogos = [
    { code: 'MI', name: 'Mumbai Indians', color: '#2074D5', logo: '/assets/teams/mi.svg' },
    { code: 'CSK', name: 'Chennai Super Kings', color: '#F9D47B', logo: '/assets/teams/csk.svg' },
    { code: 'RCB', name: 'Royal Challengers Bengaluru', color: '#EB547C', logo: '/assets/teams/rcb.svg' },
    { code: 'KKR', name: 'Kolkata Knight Riders', color: '#3A225D', logo: '/assets/teams/kkr.svg' },
    { code: 'RR', name: 'Rajasthan Royals', color: '#EA1B75', logo: '/assets/teams/rr.svg' },
    { code: 'DC', name: 'Delhi Capitals', color: '#004C97', logo: '/assets/teams/dc.svg' },
    { code: 'SRH', name: 'Sunrisers Hyderabad', color: '#F26522', logo: '/assets/teams/srh.svg' },
    { code: 'LSG', name: 'Lucknow Super Giants', color: '#0057E7', logo: '/assets/teams/lsg.svg' },
    { code: 'PBKS', name: 'Punjab Kings', color: '#ED1B24', logo: '/assets/teams/pbks.svg' },
    { code: 'GT', name: 'Gujarat Titans', color: '#1B2133', logo: '/assets/teams/gt.svg' },
  ]

  // ════════════════════════════════════════════════════════════════
  // 1. LANDING PAGE: Pure atmospheric entrance
  // Same background as home page, no other details except "IPL AUCTION"
  // header same as written on the main page, and a small enter button
  // ════════════════════════════════════════════════════════════════
  if (!hasEntered) {
    return (
      <div className="relative min-h-screen w-full bg-[#121212] text-white overflow-hidden select-none">
        {/* Same high-resolution architectural background */}
        <div 
          className="fixed inset-0 z-0 bg-cover bg-no-repeat bg-[position:72%_center] lg:bg-[position:center_right]"
          style={{ backgroundImage: "url('/assets/landing/ipl-auction-environment.webp')" }}
        />

        {/* Subtle readability gradient scrim on the left */}
        <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-r from-black/60 via-black/20 to-transparent lg:from-black/45 lg:via-black/10 lg:to-transparent" />

        {/* Landing Page Content: Purely "IPL AUCTION" header and small enter button */}
        <div className="relative z-10 flex min-h-screen flex-col justify-center px-6 py-12 md:px-12 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-start max-w-2xl"
          >
            {/* Monumental Headline: exactly as written in the main page */}
            <h1 className="font-condensed text-7xl sm:text-8xl md:text-9xl lg:text-[10.5rem] font-black uppercase tracking-tight text-white leading-[0.82] drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
              IPL<br />AUCTION
            </h1>

            {/* Small enter button below which leads directly to the home page */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setHasEntered(true)}
              className="mt-8 group inline-flex items-center gap-2.5 border border-white/30 bg-[#2074D5] hover:bg-[#1A63B8] px-6 py-2.5 font-condensed text-base md:text-lg font-black uppercase tracking-widest text-white shadow-[0_0_25px_rgba(32,116,213,0.4)] transition-all duration-200"
            >
              <span>ENTER</span>
              <ArrowRight size={18} className="transition-transform duration-150 group-hover:translate-x-1" />
            </motion.button>
          </motion.div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // 2. HOME PAGE: Contains the "ENTER AS ADMIN" and "ENTER AS TEAM" login options
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="relative min-h-screen w-full bg-[#121212] text-white overflow-x-hidden select-none">
      {/* Global Architectural Background */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-no-repeat bg-[position:72%_center] lg:bg-[position:center_right] pointer-events-none"
        style={{ backgroundImage: "url('/assets/landing/ipl-auction-environment.webp')" }}
      />

      {/* Subtle localized gradient on the far-left edge */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-r from-black/60 via-black/20 to-transparent lg:from-black/45 lg:via-black/10 lg:to-transparent" />

      {/* Content wrapper */}
      <div className="relative z-10 flex min-h-screen flex-col justify-between">
        {/* Top Architectural Global Header */}
        <GlobalHeader
          roomId={activeRoom?.id}
          roomName={activeRoom?.name}
          phase={activeRoom?.phase || 'LIVE'}
          round={activeRoom?.round}
        />

        {/* Dynamic Screen Transitions (Home Main <-> Roles Selection) */}
        <AnimatePresence mode="wait">
          {currentScreen === 'main' ? (
            /* 
              ============================================================
              HOME PAGE MAIN VIEW (Login options: TEAM & ADMIN)
              ============================================================
            */
            <motion.main
              key="main-landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col justify-between px-6 py-8 md:px-12 lg:px-16 min-h-[calc(100vh-3.5rem-2.5rem)]"
            >
              {/* Middle Section: Left Editorial Title + Action Plaques */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-8 items-center my-auto pt-4 pb-6">
                {/* Left Column: Monumental Headline & Exhibition Plaques */}
                <div className="flex flex-col max-w-2xl">
                  {/* Category Microcopy */}
                  <span className="font-mono text-xs font-black uppercase tracking-[0.3em] text-white/80 mb-2">
                    INDIAN PREMIER LEAGUE
                  </span>

                  {/* Monumental Condensed Headline */}
                  <h1 className="font-condensed text-7xl sm:text-8xl md:text-9xl lg:text-[10.5rem] font-black uppercase tracking-tight text-white leading-[0.82] drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
                    IPL<br />AUCTION
                  </h1>

                  {/* Editorial Tagline with Yellow Accent Line */}
                  <div className="mt-6 flex flex-col gap-1 border-l-2 border-[#F9D47B] pl-4 py-0.5">
                    <span className="font-heading text-sm sm:text-base font-black uppercase tracking-[0.2em] text-white drop-shadow">
                      BIGGER PLAYERS. BOLDER MOVES.
                    </span>
                    <span className="font-mono text-xs tracking-[0.16em] text-white/70 uppercase">
                      A NEW CHAPTER AWAITS.
                    </span>
                  </div>

                  {/* Architectural Signage / Exhibition Plaques: ENTER AS TEAM & ENTER AS ADMIN */}
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                    {/* ENTER AS TEAM - Architectural Blue Plaque */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoleTab('team')
                        setCurrentScreen('roles')
                      }}
                      className="group flex flex-col justify-between border border-[#2074D5] hover:border-white/50 bg-[#2074D5] hover:bg-[#1A63B8] p-5 text-left shadow-[0_0_30px_rgba(32,116,213,0.35)] transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/90">
                          ENTER AS
                        </span>
                        <ArrowRight size={20} className="text-white transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                      <div className="mt-4">
                        <span className="font-condensed text-4xl sm:text-5xl font-black uppercase tracking-tight text-white block leading-none">
                          TEAM
                        </span>
                        <span className="mt-2 block font-mono text-[9px] uppercase tracking-wider text-white/85">
                          MANAGE YOUR SQUAD • PARTICIPATE IN AUCTIONS
                        </span>
                      </div>
                    </button>

                    {/* ENTER AS ADMIN - Architectural Dark Charcoal Plaque */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoleTab('admin')
                        setCurrentScreen('roles')
                      }}
                      className="group flex flex-col justify-between border border-white/20 hover:border-white/50 bg-[#282828] hover:bg-[#333333] p-5 text-left shadow-2xl transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">
                          ENTER AS
                        </span>
                        <ArrowRight size={20} className="text-white/60 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-white" />
                      </div>
                      <div className="mt-4">
                        <span className="font-condensed text-4xl sm:text-5xl font-black uppercase tracking-tight text-white block leading-none">
                          ADMIN
                        </span>
                        <span className="mt-2 block font-mono text-[9px] uppercase tracking-wider text-white/55">
                          CONTROL THE AUCTION • RUN THE EVENT
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Secondary Fast-Pass Action & Room Selector */}
                  <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoleTab('all')
                        setCurrentScreen('roles')
                      }}
                      className="inline-flex items-center gap-2 border border-white/20 bg-black/40 hover:bg-white/10 px-4 py-2 uppercase tracking-widest text-white/80 hover:text-white transition-colors backdrop-blur-sm"
                    >
                      <Sparkles size={14} className="text-[#F9D47B]" />
                      <span>SELECT YOUR ROLE &rarr;</span>
                    </button>

                    {rooms.length > 1 && (
                      <div className="flex items-center gap-2 border border-white/15 bg-black/40 px-3 py-2 backdrop-blur-sm">
                        <Layers size={12} className="text-brand-blue" />
                        <span className="text-white/50 uppercase text-[10px] tracking-widest">ROOM:</span>
                        <select
                          value={activeRoomId}
                          onChange={(e) => setActiveRoomId(e.target.value)}
                          aria-label="Select Auction Room"
                          className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
                        >
                          {rooms.map((r) => (
                            <option key={r.id} value={r.id} className="bg-[#1C1C1C]">
                              {r.name} ({r.phase})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Kept unobstructed to reveal background courtyard */}
                <div className="hidden lg:block min-h-[460px] w-full pointer-events-none" />
              </div>

              {/* Bottom Strip: 10 Official Franchise SVG Logos */}
              <div className="relative z-20 mt-8 border-t border-white/15 pt-5 pb-2">
                <div className="mb-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.25em] text-white/60">
                  <span>ALL 10 TEAMS • ONE AUCTION</span>
                  <span>CRICKET BUILDS BRIDGES</span>
                </div>

                <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none">
                  {franchiseLogos.map((team) => (
                    <div
                      key={team.code}
                      onClick={() => {
                        setSelectedRoleTab('team')
                        setCurrentScreen('roles')
                      }}
                      className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100 shrink-0 cursor-pointer"
                      title={`${team.name} — Click to choose table`}
                    >
                      {/* Individual Local SVG Logo */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={team.logo}
                        alt={team.name}
                        className="h-8 w-8 object-contain filter drop-shadow"
                      />
                      <span className="font-condensed text-xs font-black tracking-wider text-white hidden md:inline">
                        {team.code}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.main>
          ) : (
            /* 
              ============================================================
              ROLE / TABLE SELECTION SCREEN (Same Architectural Environment)
              ============================================================
            */
            <motion.main
              key="role-selection"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col justify-center px-6 py-10 md:px-12 lg:px-16 min-h-[calc(100vh-3.5rem-2.5rem)]"
            >
              <div className="max-w-4xl w-full mx-auto">
                {/* Back to Home Page button */}
                <button
                  type="button"
                  onClick={() => setCurrentScreen('main')}
                  className="mb-6 inline-flex items-center gap-2 border border-white/20 bg-black/40 hover:bg-white/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white/80 hover:text-white transition-colors backdrop-blur-sm"
                >
                  <ChevronLeft size={16} />
                  <span>RETURN TO HOME</span>
                </button>

                {/* Architectural Exhibition Plaque for Role Selection */}
                <div className="border border-white/20 bg-[#161616]/90 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
                  {/* Header */}
                  <div className="border-b border-white/10 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <span className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-[#2074D5]">
                        INDIAN PREMIER LEAGUE AUCTION
                      </span>
                      <h2 className="font-condensed text-4xl sm:text-5xl font-black uppercase text-white tracking-tight leading-none mt-1">
                        SELECT YOUR ROLE
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedRoleTab('all')}
                        className={`px-3 py-1.5 uppercase tracking-wider border ${
                          selectedRoleTab === 'all'
                            ? 'border-white bg-white text-black font-bold'
                            : 'border-white/20 text-white/60 hover:text-white'
                        }`}
                      >
                        ALL
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRoleTab('team')}
                        className={`px-3 py-1.5 uppercase tracking-wider border ${
                          selectedRoleTab === 'team'
                            ? 'border-[#2074D5] bg-[#2074D5] text-white font-bold'
                            : 'border-white/20 text-white/60 hover:text-white'
                        }`}
                      >
                        TEAM
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRoleTab('admin')}
                        className={`px-3 py-1.5 uppercase tracking-wider border ${
                          selectedRoleTab === 'admin'
                            ? 'border-[#F9D47B] bg-[#F9D47B] text-black font-bold'
                            : 'border-white/20 text-white/60 hover:text-white'
                        }`}
                      >
                        ADMIN
                      </button>
                    </div>
                  </div>

                  {/* Primary Choices Grid */}
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* TEAM ROLE SECTION */}
                    {(selectedRoleTab === 'all' || selectedRoleTab === 'team') && (
                      <div className="border border-white/10 bg-[#1C1C1C]/80 p-6 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-[#2074D5] mb-2">
                            <Users size={20} />
                            <span className="font-mono text-xs font-bold uppercase tracking-widest">
                              FRANCHISE TABLE
                            </span>
                          </div>
                          <h3 className="font-condensed text-3xl font-black uppercase text-white">
                            TEAM
                          </h3>
                          <p className="mt-2 text-sm text-white/70 font-sans leading-relaxed">
                            Manage your squad, participate in live bidding paddles, budget monitoring, and strategy.
                          </p>

                          {/* 10 Team Tables Selector */}
                          <div className="mt-5">
                            <span className="block font-mono text-[10px] uppercase tracking-widest text-white/50 mb-2.5">
                              SELECT YOUR FRANCHISE WAR ROOM TABLE:
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              {activeRoom?.teams.map((t) => (
                                <Link
                                  key={t.id}
                                  href={`/team/${activeRoom.id}/${t.id}`}
                                  className="flex flex-col items-center justify-center p-2.5 border border-white/10 bg-[#222222] hover:border-[#2074D5] hover:bg-[#2074D5]/20 transition-all text-center group"
                                  title={t.name}
                                >
                                  <TeamCrest
                                    shortCode={t.shortCode}
                                    name={t.name}
                                    colorAccent={t.colorAccent}
                                    logoUrl={t.logoUrl}
                                    mark
                                    className="h-8 w-8 drop-shadow-md group-hover:scale-105 transition-transform"
                                  />
                                  <span className="mt-1.5 font-condensed text-xs font-black text-white">
                                    {t.shortCode}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ADMIN ROLE SECTION */}
                    {(selectedRoleTab === 'all' || selectedRoleTab === 'admin') && (
                      <div className="border border-white/10 bg-[#1C1C1C]/80 p-6 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-[#F9D47B] mb-2">
                            <Shield size={20} />
                            <span className="font-mono text-xs font-bold uppercase tracking-widest">
                              AUCTIONEER CONSOLE
                            </span>
                          </div>
                          <h3 className="font-condensed text-3xl font-black uppercase text-white">
                            ADMIN
                          </h3>
                          <p className="mt-2 text-sm text-white/70 font-sans leading-relaxed">
                            Control the auction and run the event. Drive countdown timers, announce lots, resolve hammer bids, and manage event flow.
                          </p>
                        </div>

                        <div className="mt-6 flex flex-col gap-3">
                          <Link
                            href={`/admin/${activeRoom?.id}`}
                            className="flex items-center justify-center gap-3 bg-[#282828] hover:bg-[#333333] border border-white/20 p-4 font-condensed text-xl font-black uppercase tracking-wider text-white shadow-xl transition-all"
                          >
                            <Shield size={20} className="text-[#F9D47B]" />
                            <span>ENTER ADMIN CONSOLE</span>
                            <ArrowRight size={20} />
                          </Link>
                          <span className="font-mono text-[10px] tracking-widest text-white/40 text-center uppercase">
                            PIN PROTECTED ACCESS • PIN: 2629
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Broadcast Display Link and Room Info */}
                  <div className="mt-8 flex flex-wrap items-center justify-between border-t border-white/10 pt-4 font-mono text-xs text-white/50 gap-4">
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-brand-blue" />
                      <span>ROOM: <strong className="text-white">{activeRoom?.name}</strong> ({activeRoom?.phase})</span>
                    </div>

                    <Link
                      href={`/display/${activeRoom?.id}`}
                      className="flex items-center gap-2 text-[#F9D47B] hover:underline"
                    >
                      <Tv size={14} />
                      <span>SPECTATE BROADCAST DISPLAY BOARD &rarr;</span>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.main>
          )}
        </AnimatePresence>

        {/* Global Architectural Footer */}
        <GlobalFooter
          tagline="MORE THAN A TOURNAMENT. A LEGACY IN MOTION."
          year="IPL AUCTION 2024"
        />
      </div>
    </div>
  )
}
