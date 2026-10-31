'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Hand,
  X,
  TriangleAlert,
  Maximize2,
  Search,
} from 'lucide-react'
import { IplLogo } from '@/components/ui/ipl-logo'
import { TeamCrest } from '@/components/ui/team-crest'
import { LotPhoto } from '@/components/auction/lot-photo'
import { RatingPanel, RatingTile } from '@/components/auction/rating-panel'
import { SoldCelebration } from '@/components/auction/sold-celebration'
import { SquadNeeds } from '@/components/auction/squad-rules'
import { Model3D } from '@/components/ui/model-3d'
import { LogoutButton } from '@/components/ui/logout-button'
import { logoutTeam } from '@/lib/pin-actions'
import { bidRejectionReason, getNextBidAmount } from '@/lib/bid-rules'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { applyLiveEvent, newer } from '@/lib/live-events'
import { formatMoney } from '@/lib/money'
import { categoryLabel } from '@/lib/team-rules'
import { unwrap } from '@/lib/action-result'
import {
  getPublicSnapshot,
  claimLot,
  type PublicSnapshot,
  type RoomPlayerItem,
} from '@/app/admin/[roomId]/actions'

interface TeamThemeConfig {
  primary: string
  purseBg: string
  purseHex?: string
  purseText: string
  buttonTextColor?: string
  glow: string
  accentBorder: string
}

const DEFAULT_THEME: TeamThemeConfig = {
  primary: '#2074D5',
  purseBg: 'bg-[#15458F]',
  purseHex: '#15458F',
  purseText: 'text-white',
  buttonTextColor: '#FFFFFF',
  glow: 'rgba(32, 116, 213, 0.45)',
  accentBorder: 'border-[#2074D5]/50',
}

const TEAM_THEMES: Record<string, TeamThemeConfig> = {
  CSK: {
    primary: '#F9CD05',
    purseBg: 'bg-[#F9CD05]',
    purseHex: '#F9CD05',
    purseText: 'text-[#0D0D0F]',
    buttonTextColor: '#0D0D0F',
    glow: 'rgba(249, 205, 5, 0.45)',
    accentBorder: 'border-[#F9CD05]/50',
  },
  MI: {
    primary: '#005DAA',
    purseBg: 'bg-[#004BA0]',
    purseHex: '#004BA0',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(0, 93, 170, 0.45)',
    accentBorder: 'border-[#005DAA]/50',
  },
  RCB: {
    primary: '#EC1C24',
    purseBg: 'bg-[#B8151B]',
    purseHex: '#B8151B',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(236, 28, 36, 0.45)',
    accentBorder: 'border-[#EC1C24]/50',
  },
  KKR: {
    primary: '#3A225D',
    purseBg: 'bg-[#3A225D]',
    purseHex: '#3A225D',
    purseText: 'text-[#F9CD05]',
    buttonTextColor: '#F9CD05',
    glow: 'rgba(58, 34, 93, 0.45)',
    accentBorder: 'border-[#3A225D]/50',
  },
  SRH: {
    primary: '#F26522',
    purseBg: 'bg-[#C7480C]',
    purseHex: '#C7480C',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(242, 101, 34, 0.45)',
    accentBorder: 'border-[#F26522]/50',
  },
  DC: {
    primary: '#17479E',
    purseBg: 'bg-[#0E357E]',
    purseHex: '#0E357E',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(23, 71, 158, 0.45)',
    accentBorder: 'border-[#17479E]/50',
  },
  RR: {
    primary: '#EA1B86',
    purseBg: 'bg-[#BA1168]',
    purseHex: '#BA1168',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(234, 27, 134, 0.45)',
    accentBorder: 'border-[#EA1B86]/50',
  },
  GT: {
    primary: '#1B2133',
    purseBg: 'bg-[#1B2133]',
    purseHex: '#1B2133',
    purseText: 'text-[#B89B5E]',
    buttonTextColor: '#B89B5E',
    glow: 'rgba(27, 33, 51, 0.45)',
    accentBorder: 'border-[#1B2133]/50',
  },
  LSG: {
    primary: '#A72056',
    purseBg: 'bg-[#781438]',
    purseHex: '#781438',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(167, 32, 86, 0.45)',
    accentBorder: 'border-[#A72056]/50',
  },
  PBKS: {
    primary: '#ED1B24',
    purseBg: 'bg-[#C4141C]',
    purseHex: '#C4141C',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(237, 27, 36, 0.45)',
    accentBorder: 'border-[#ED1B24]/50',
  },
}

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
  const leaderRef = useRef(initialSnapshot.currentLot?.currentBiddingTeamId ?? null)
  const outbidTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // 3D crest coin intro on entering the war room (clip is 2s)
  const [showIntro, setShowIntro] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 2400)
    return () => clearTimeout(t)
  }, [])

  // Interactive modal states
  const [showSquadModal, setShowSquadModal] = useState(false)
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [previewPlayer, setPreviewPlayer] = useState<RoomPlayerItem | null>(null)
  const [soldTrigger, setSoldTrigger] = useState<number>(0)
  const lastLotStatusRef = useRef(initialSnapshot.currentLot?.status)

  const { snapshot, setSnapshot } = useLiveSnapshot(roomId, initialSnapshot, getPublicSnapshot, {
    applyEvent: applyLiveEvent,
    versionOf: (s) => s.at,
    onEvent: (event) => {
      if (event.type === 'REPLAY') return setSoldTrigger((t) => t + 1)
      if (event.type !== 'BID') return
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
    },
  })

  // The one place the celebration fires: the lot turning SOLD in the snapshot
  useEffect(() => {
    const currentStatus = snapshot.currentLot?.status
    if (lastLotStatusRef.current !== 'SOLD' && currentStatus === 'SOLD') {
      setSoldTrigger((t) => t + 1)
    }
    lastLotStatusRef.current = currentStatus
  }, [snapshot.currentLot?.status])

  const team = snapshot.teams.find((t) => t.id === teamId) ?? snapshot.teams[0]!
  const lot = snapshot.currentLot
  const closed = lot?.status === 'SOLD' || lot?.status === 'UNSOLD'
  const leading = lot?.currentBiddingTeamId === teamId
  const leader = snapshot.teams.find((t) => t.id === lot?.currentBiddingTeamId)
  const dropped = !!lot && lot.droppedTeamIds.includes(teamId)
  const inContest = !!lot && lot.activeBidders.includes(teamId)
  const contestants = (lot?.activeBidders ?? [])
    .map((id) => snapshot.teams.find((t) => t.id === id)?.shortCode)
    .filter(Boolean)
  const paused = snapshot.room.phase === 'PAUSED'
  const ended = snapshot.room.phase === 'COMPLETED'

  const nextBid = lot
    ? lot.status === 'BIDDING'
      ? getNextBidAmount(lot.currentBid, lot.player.basePrice)
      : lot.currentBid
    : 0

  const rejection = lot
    ? bidRejectionReason(team, lot, nextBid)
    : 'No active lot'

  // Teams don't bid from this screen: they press I'M IN, the first two in
  // contest the lot, and the auctioneer enters every bid for them.
  const canClaim = !!lot && !closed && !paused && !ended && !inContest && !rejection && !pending

  async function claim() {
    if (!canClaim) return
    setPending(true)
    setError(null)
    try {
      const next = unwrap(await claimLot(roomId, teamId))
      setSnapshot((prev) => newer(prev, next))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not in this time')
      getPublicSnapshot(roomId).then((fresh) => setSnapshot((prev) => newer(prev, fresh)), () => {})
    } finally {
      setPending(false)
    }
  }

  // A refused I'M IN is news for a moment, not for the rest of the lot.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(t)
  }, [error])

  // Space presses I'M IN: speed decides who gets in. Never while a modal is
  // open over the panel, and never from a held-down key repeating.
  const modalOpen = showSquadModal || showAnalyticsModal || !!previewPlayer
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== ' ' || e.repeat || modalOpen) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return
      e.preventDefault()
      claim()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    leaderRef.current = lot?.currentBiddingTeamId ?? null
  }, [lot?.currentBiddingTeamId])

  useEffect(() => () => clearTimeout(outbidTimer.current), [])

  // Bidding status message
  const statusMessage = ended
    ? 'auction has ended'
    : paused
    ? 'auction paused'
    : leading
    ? 'you hold the highest bid'
    : inContest
    ? "you're in — call your bids"
    : dropped
    ? 'you dropped out of this lot'
    : !lot || closed
    ? 'waiting for the auctioneer'
    : rejection === 'Purse insufficient'
    ? 'purse insufficient'
    : rejection
    ? rejection
    : null

  // Role and set category formatting
  const roleDisplay = (lot?.player.role || 'BATTER').replace('_', ' ').toUpperCase()
  const setCategory = lot ? categoryLabel(lot.player) : ''

  // Photo resolution with fallback
  const photo = lot?.player.photoUrl || (
    lot?.player.name.toLowerCase().includes('dhoni')
      ? '/players/csk-mahendra-singh-dhoni.webp'
      : lot?.player.name.toLowerCase().includes('virat kohli')
      ? '/players/rcb-virat-kohli.webp'
      : lot?.player.name.toLowerCase().includes('rohit sharma')
      ? '/players/mi-rohit-sharma.webp'
      : null
  )

  const teamCode = team.shortCode.toUpperCase()
  const theme = TEAM_THEMES[teamCode] || DEFAULT_THEME
  const teamBgSvg = `/assets/teams/${teamCode.toLowerCase()}-team-bg.webp`

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0d0d0f] text-white select-none overflow-x-hidden">
      {/* Environmental Architectural Backdrop */}
      <picture className="fixed inset-0 z-0 h-full w-full pointer-events-none select-none lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={teamBgSvg}
          alt={`${team.name} War Room Architecture`}
          className="h-full w-full object-cover object-left-top opacity-95 pointer-events-none select-none"
        />
      </picture>
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-r from-transparent via-black/35 to-black/75 lg:hidden" />

      {/* ── Top Broadcast Header Bar (Reference 3 Aesthetic) ── */}
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-white/10 bg-[#121214]/90 px-4 md:px-6 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <Link href={`/display/${roomId}`} className="flex items-center gap-2 group transition-opacity hover:opacity-90">
            <IplLogo size="sm" />
          </Link>

          {/* Navigation Tabs (Functional interactive tabs) */}
          <nav className="hidden sm:flex items-center gap-1 font-mono text-[11px] font-bold tracking-wider">
            <button
              onClick={() => {
                setShowSquadModal(false)
                setShowAnalyticsModal(false)
              }}
              className="px-3 py-4 text-white relative flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>MY TEAM</span>
              <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: theme.primary }} />
            </button>
            <button
              onClick={() => setShowSquadModal(true)}
              className="px-3 py-4 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              SQUAD
            </button>
            <LogoutButton
              action={() => logoutTeam(teamId)}
              className="px-3 py-4 text-white/50 hover:text-white transition-colors cursor-pointer"
            />
            <button
              onClick={() => {
                document.getElementById('bidding-panel')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="px-3 py-4 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              BIDDING
            </button>
            <button
              onClick={() => setShowAnalyticsModal(true)}
              className="px-3 py-4 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              ANALYTICS
            </button>
          </nav>
        </div>

        {/* Right side: Franchise Badge & User Avatar */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 border bg-[#1C1C20] px-3 py-1.5 font-condensed text-sm font-bold uppercase tracking-wider text-white shadow-sm"
            style={{ borderColor: `${theme.primary}50` }}
          >
            <TeamCrest
              shortCode={team.shortCode}
              name={team.name}
              colorAccent={team.colorAccent}
              logoUrl={team.logoUrl}
              mark
              className="h-4 w-4"
            />
            <span>{team.name}</span>
          </div>

          <div
            className="h-8 w-8 rounded-full border bg-[#222226] flex items-center justify-center font-mono text-xs font-bold"
            style={{ borderColor: `${theme.primary}60`, color: theme.primary }}
          >
            {team.shortCode.slice(0, 2)}
          </div>
        </div>
      </header>

      {/* ── Main Composition: left column sized to the flag in the backdrop (flag ends ~34% of the image height across) ── */}
      <div className="relative z-10 grid flex-1 grid-cols-1 lg:grid-cols-[calc(max(23vh,13vw)_+_8px)_1fr] min-h-0">
        {/* Team flag crop, fitted to this column on desktop */}
        <div aria-hidden className="hidden lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/assets/teams/${teamCode.toLowerCase()}-team-side.webp`}
            alt=""
            className="sticky top-14 h-[calc(100vh-3.5rem)] w-full object-contain object-top pointer-events-none select-none"
          />
        </div>

        {/* ── Main Content Area ── */}
        <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6 min-h-0">
          {/* Top Row: Team Name & Monumental Hero Metrics Plates (Reference 3) */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <h1 className="font-condensed text-4xl sm:text-5xl font-black uppercase tracking-tight text-white leading-none">
              {team.name}
            </h1>

            <div className="flex flex-wrap items-center gap-3">
              {/* REMAINING PURSE: Monumental Box */}
              <div
                className={`flex flex-col ${theme.purseBg} px-5 py-2.5 shadow-lg`}
                style={{
                  backgroundColor: theme.purseHex || undefined,
                  boxShadow: `0 0 20px ${theme.glow}`,
                }}
              >
                <span
                  className={`font-mono text-[9px] font-black uppercase tracking-[0.2em] ${
                    theme.purseText.includes('text-[#') ? 'text-[#0D0D0F]/80' : 'text-white/80'
                  }`}
                >
                  REMAINING PURSE
                </span>
                <span className={`font-condensed text-3xl font-black ${theme.purseText} leading-none mt-0.5 tabular-nums`}>
                  {formatMoney(team.purseRemaining)}
                </span>
              </div>

              {/* SQUAD SIZE */}
              <div className="flex flex-col border border-white/15 bg-[#17171A] px-4 py-2.5 shadow-sm">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                  SQUAD SIZE
                </span>
                <span className="font-condensed text-2xl sm:text-3xl font-black text-white leading-none mt-0.5 tabular-nums">
                  {team.squadCount} / {team.squadMax}
                </span>
              </div>

              {/* OVERSEAS SLOTS */}
              <div className="flex flex-col border border-white/15 bg-[#17171A] px-4 py-2.5 shadow-sm">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                  OVERSEAS SLOTS
                </span>
                <span className="font-condensed text-2xl sm:text-3xl font-black text-white leading-none mt-0.5 tabular-nums">
                  {team.overseasSlotsUsed} / {team.overseasSlotsMax}
                </span>
              </div>
            </div>
          </div>

          {/* What the squad still needs for a legal XI */}
          <SquadNeeds squad={team.squad} />

          {/* Top Grid: Active Player Card & Bidding Details | Bidding Control Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
            {/* ── Active Player & Bidding Details Card ── */}
            <div className="border border-white/10 bg-[#141417]/85 p-3.5 backdrop-blur-md shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] xl:grid-cols-[300px_1fr] gap-4 h-full">
                {/* Framed Player Photo with Glowing Accent & Click to Expand */}
                <div
                  className="group relative aspect-square w-full self-start border-2 bg-[#0E0E11] overflow-hidden flex items-center justify-center cursor-pointer"
                  style={{
                    borderColor: theme.primary,
                    boxShadow: `0 0 15px ${theme.glow}`,
                  }}
                  onClick={() => lot && setPreviewPlayer(lot.player as unknown as RoomPlayerItem)}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <LotPhoto src={photo} alt={lot ? lot.player.name : 'Player'} soldTo={lot?.status === 'SOLD' ? leader ?? null : null} className="absolute inset-0 overflow-hidden" />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 text-center p-4">
                      <span className="font-condensed text-5xl font-black text-white/20">
                        {lot ? lot.player.name.slice(0, 2).toUpperCase() : 'IPL'}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                        {lot ? lot.player.nationality : 'NEXT LOT'}
                      </span>
                    </div>
                  )}

                  {/* Hover hint to expand */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 font-mono text-xs font-bold text-brand-yellow">
                    <Maximize2 className="h-4 w-4" />
                    <span>EXPAND</span>
                  </div>
                </div>

                {/* Right: Player Name Banner & Sub-Layout */}
                <div className="flex flex-col justify-between gap-3">
                  {/* Flag-Themed Player Header Banner */}
                  <div
                    className="px-4 py-2.5 shadow-md flex items-center justify-between"
                    style={{
                      backgroundColor: theme.primary,
                      color: theme.buttonTextColor || '#FFFFFF',
                    }}
                  >
                    <div>
                      <h2 className="font-condensed text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none truncate">
                        {lot ? lot.player.name : 'AWAITING NEXT LOT'}
                      </h2>
                      <p
                        className="font-mono text-[10px] font-bold uppercase tracking-wider mt-1"
                        style={{ opacity: 0.85 }}
                      >
                        {lot ? `${setCategory} • ${roleDisplay}` : 'AUCTION STAGE PAUSED'}
                      </p>
                    </div>
                    {lot && (
                      <button
                        onClick={() => setPreviewPlayer(lot.player as unknown as RoomPlayerItem)}
                        className="flex items-center gap-1 bg-black/30 hover:bg-black/45 px-2 py-1 font-mono text-[9px] font-black uppercase tracking-wider text-white transition-colors cursor-pointer"
                      >
                        <Maximize2 className="h-3 w-3" />
                        <span className="hidden sm:inline">EXPAND</span>
                      </button>
                    )}
                  </div>

                  {/* Sub-Layout: CURRENT BID & 2x2 Grid */}
                  <div className="grid grid-cols-1 gap-3 flex-1">
                    {/* Left: CURRENT BID Plate & 2x2 Info Grid */}
                    <div className="flex flex-col justify-between gap-2.5">
                      {/* CURRENT BID with the rating beside it */}
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <div className="flex flex-col justify-center bg-[#EB547C] p-3 text-white shadow-[0_0_20px_rgba(235,84,124,0.3)]">
                          <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/85 block">
                            CURRENT BID
                          </span>
                          <div className="font-condensed text-4xl sm:text-5xl font-black leading-none tracking-tight text-white mt-1 tabular-nums">
                            {lot ? formatMoney(lot.currentBid) : '—'}
                          </div>
                        </div>
                        {lot && <RatingTile name={lot.player.name} />}
                      </div>

                      {/* 2x2 Info Grid: TEAM | ROLE | BASE | ORIGIN */}
                      <div className="grid grid-cols-2 gap-px bg-white/15 border border-white/15">
                        {/* TEAM */}
                        <div className="bg-[#17171A] p-2">
                          <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                            TEAM
                          </span>
                          <span className="font-condensed text-sm sm:text-base font-black uppercase text-white truncate block mt-0.5">
                            {leader ? leader.name : 'Waiting for bid'}
                          </span>
                        </div>

                        {/* ROLE */}
                        <div className="bg-[#17171A] p-2">
                          <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                            ROLE
                          </span>
                          <span className="font-condensed text-sm sm:text-base font-black uppercase text-white truncate block mt-0.5">
                            {lot ? roleDisplay : '—'}
                          </span>
                        </div>

                        {/* BASE */}
                        <div className="bg-[#17171A] p-2">
                          <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                            BASE
                          </span>
                          <span className="font-condensed text-sm sm:text-base font-black uppercase text-brand-yellow truncate block mt-0.5 tabular-nums">
                            {lot ? formatMoney(lot.player.basePrice) : '—'}
                          </span>
                        </div>

                        {/* ORIGIN */}
                        <div className="bg-[#17171A] p-2">
                          <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                            ORIGIN
                          </span>
                          <span className="font-condensed text-sm sm:text-base font-black uppercase text-white truncate block mt-0.5">
                            {lot ? (lot.player.isOverseas ? 'OVERSEAS' : 'INDIAN') : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Bidding Control Panel ── */}
            <div
              id="bidding-panel"
              className="flex flex-col border border-white/10 bg-[#141417]/85 backdrop-blur-md shadow-2xl"
            >
              <div className="p-4 flex flex-col justify-between flex-1 gap-3">
                {/* NEXT BID strip */}
                <div className="flex items-center justify-between border border-white/15 bg-[#1C1C20] px-3.5 py-2.5 shadow-inner">
                  <span className="font-mono text-[9px] font-black uppercase tracking-wider text-white/70">
                    NEXT BID
                  </span>
                  <span className="font-condensed text-2xl font-black text-white tabular-nums">
                    {lot && !closed ? formatMoney(nextBid) : formatMoney(lot?.currentBid ?? 0)}
                  </span>
                </div>

                {/* I'M IN: the first two teams to press it contest the lot. No BID
                    button — the auctioneer enters every bid. */}
                <button
                  onClick={claim}
                  disabled={!canClaim}
                  className="flex items-center justify-between px-5 py-3.5 hover:opacity-95 active:scale-[0.99] disabled:opacity-35 disabled:cursor-not-allowed transition-all font-condensed text-2xl font-black uppercase tracking-wider cursor-pointer"
                  style={
                    inContest || canClaim
                      ? {
                          backgroundColor: theme.primary,
                          color: theme.buttonTextColor || '#FFFFFF',
                          boxShadow: `0 0 20px ${theme.glow}`,
                          opacity: 1,
                        }
                      : { backgroundColor: '#2074D5', color: '#FFFFFF' }
                  }
                >
                  <span>{inContest ? "YOU'RE IN" : dropped ? 'DROPPED' : "I'M IN"}</span>
                  <Hand className="h-5 w-5" />
                </button>
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/50">
                  {inContest
                    ? 'Call out your bids — the auctioneer enters them'
                    : 'First two teams in get to bid — the auctioneer enters every bid'}
                </p>

                {/* Live status */}
                <div className="pt-1 flex flex-wrap items-center justify-between gap-1 border-t border-white/10 mt-1">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/50">
                    {contestants.length ? `IN: ${contestants.join(' vs ')}` : 'PRESS SPACE FOR I\'M IN'}
                  </span>
                  {statusMessage && (
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-yellow">
                      {statusMessage}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: BIDDING LOG */}
          <div className="grid grid-cols-1 gap-4">
            {/* BIDDING LOG */}
            <div className="flex flex-col border border-white/10 bg-[#141417]/85 backdrop-blur-md shadow-2xl">
              {/* Header */}
              <div className="bg-[#0D0D0F] border-b border-white/10 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                BIDDING LOG
              </div>

              <div className="p-3.5 flex-1 flex flex-col justify-center min-h-[140px] max-h-[190px] overflow-y-auto">
                {!lot?.bidHistory || lot.bidHistory.length === 0 ? (
                  <div className="flex items-center justify-center my-auto py-6">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-white/40 text-center">
                      NO BIDS ON THIS LOT YET
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 w-full">
                    {[...lot.bidHistory].reverse().map((bid, i) => (
                      <div
                        key={`${bid.teamId}-${bid.timestamp}-${i}`}
                        className="flex items-center justify-between border border-white/10 bg-[#1C1C20] px-2.5 py-1 text-xs"
                      >
                        <span className="font-condensed font-black uppercase text-brand-yellow truncate max-w-[90px]">
                          {bid.teamName}
                        </span>
                        <span className="font-mono font-bold text-white tabular-nums">
                          {formatMoney(bid.amount)}
                        </span>
                        <span className="font-mono text-[9px] text-white/40">
                          {new Date(bid.timestamp).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── SQUAD MODAL ── */}
      <AnimatePresence>
        {showSquadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl border border-white/20 bg-[#141417] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-4">
                <div>
                  <h3 className="font-condensed text-2xl font-black uppercase text-white">
                    {team.name} SQUAD ROSTER
                  </h3>
                  <p className="font-mono text-xs text-white/50">
                    {team.squadCount} of {team.squadMax} players signed • {team.overseasSlotsUsed} overseas
                  </p>
                </div>
                <button
                  onClick={() => setShowSquadModal(false)}
                  className="p-1 text-white/60 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {team.squad.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="font-condensed text-lg uppercase text-white/40">
                    No players signed yet in this auction.
                  </p>
                  <p className="font-mono text-xs text-white/30 mt-1">
                    Your purse remains fully liquid at {formatMoney(team.purseRemaining)}.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                  {team.squad.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between border border-white/10 bg-[#1C1C20] p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-black border border-white/15 flex items-center justify-center font-condensed font-bold text-xs text-white/70">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-condensed text-sm font-bold uppercase text-white block">
                            {p.name}
                          </span>
                          <span className="font-mono text-[9px] text-white/40 block">
                            {p.role.replace('_', ' ')} {p.isOverseas && '• OVERSEAS'}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-black text-brand-yellow tabular-nums">
                        {formatMoney(p.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ANALYTICS MODAL ── */}
      <AnimatePresence>
        {showAnalyticsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto border border-white/20 bg-[#141417] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-4">
                <div>
                  <h3 className="font-condensed text-2xl font-black uppercase text-white">
                    {team.name} WAR ROOM ANALYTICS
                  </h3>
                  <p className="font-mono text-xs text-white/50">
                    Purse usage
                  </p>
                </div>
                <button
                  onClick={() => setShowAnalyticsModal(false)}
                  className="p-1 text-white/60 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-white/10 bg-[#1A1A1E] p-3.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/40 block">
                    TOTAL PURSE
                  </span>
                  <span className="font-condensed text-2xl font-black text-white tabular-nums mt-0.5 block">
                    {formatMoney(team.purseTotal)}
                  </span>
                </div>

                <div className="border border-white/10 bg-[#1A1A1E] p-3.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/40 block">
                    PURSE UTILIZATION
                  </span>
                  <span className="font-condensed text-2xl font-black text-[#2074D5] tabular-nums mt-0.5 block">
                    {Math.round(((team.purseTotal - team.purseRemaining) / team.purseTotal) * 100)}%
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── EXPANDABLE PREVIEW MODAL ── */}
      <AnimatePresence>
        {previewPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-lg">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl border border-white/20 bg-[#141417] p-6 shadow-2xl text-white"
            >
              <button
                onClick={() => setPreviewPlayer(null)}
                className="absolute top-4 right-4 p-2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                <div className="relative aspect-square w-48 shrink-0 overflow-hidden border-2 border-brand-yellow bg-black shadow-xl">
                  {previewPlayer.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewPlayer.photoUrl}
                      alt={previewPlayer.name}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-condensed text-5xl font-black text-white/20">
                      {previewPlayer.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {previewPlayer.isOverseas && (
                    <div className="absolute top-2 right-2 bg-[#2074D5] text-white font-mono text-[9px] font-black px-2 py-0.5 uppercase">
                      OVERSEAS
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col gap-4">
                  <div>
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-brand-yellow">
                      {previewPlayer.setNumber || 'AUCTION POOL'} • {previewPlayer.nationality}
                    </span>
                    <h2 className="font-condensed text-3xl sm:text-4xl font-black uppercase tracking-tight text-white mt-0.5">
                      {previewPlayer.name}
                    </h2>
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-white/60 mt-1">
                      {previewPlayer.role.replace('_', ' ')}
                    </p>
                  </div>

                  <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                      BASE PRICE
                    </span>
                    <span className="font-condensed text-lg font-black text-brand-yellow tabular-nums">
                      {formatMoney(previewPlayer.basePrice)}
                    </span>
                  </div>

                  <RatingPanel name={previewPlayer.name} />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Outbid / Error Notification Toast */}
      <AnimatePresence>
        {(error || (outbid && !leading)) && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 border border-brand-pink bg-[#EB547C] px-6 py-3 font-condensed text-lg font-black uppercase tracking-widest text-white shadow-2xl"
          >
            {error ? (
              <span className="flex items-center gap-2">
                <TriangleAlert size={18} aria-hidden /> {error}
              </span>
            ) : (
              'OUTBID — CALL OUT TO COUNTER'
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="team-intro"
            exit={{ opacity: 0 }}
            onClick={() => setShowIntro(false)}
            className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-sm"
          >
            <Model3D
              src="/models/coin.glb"
              logoUrl={team.logoUrl || `/assets/teams/${team.shortCode.toLowerCase()}.svg`}
              logoBg={theme.primary}
              className="size-[min(70vw,360px)]"
            />
            <p className="font-condensed text-3xl font-black uppercase tracking-wider text-white">{team.name}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player Sold Celebration Animation Overlay */}
      <SoldCelebration
        trigger={soldTrigger}
        showCard
        player={lot?.player ? {
          name: lot.player.name,
          price: lot.currentBid,
          teamName: leader?.name,
          teamColor: leader?.colorAccent,
        } : undefined}
      />
    </div>
  )
}
