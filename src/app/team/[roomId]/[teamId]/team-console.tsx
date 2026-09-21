'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Gavel,
  Hand,
  X,
  TriangleAlert,
  Maximize2,
  Users,
  PieChart,
  Layers,
  Search,
  CheckCircle2,
} from 'lucide-react'
import { IplLogo } from '@/components/ui/ipl-logo'
import { TeamCrest } from '@/components/ui/team-crest'
import { CricketerCard } from '@/components/auction/cricketer-card'
import { SoldCelebration } from '@/components/auction/sold-celebration'
import { bidRejectionReason, getNextBidAmount } from '@/lib/bid-rules'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { formatMoney } from '@/lib/money'
import {
  getPublicSnapshot,
  placeBid,
  type PublicSnapshot,
  type RoomPlayerItem,
} from '@/app/admin/[roomId]/actions'

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

  // Calculate normalized bar heights
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
            <div className="w-full max-w-[22px] bg-white/5 flex items-end h-28 border-b border-white/15">
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

interface TeamThemeConfig {
  primary: string
  purseBg: string
  purseHex?: string
  purseText: string
  buttonTextColor?: string
  glow: string
  accentBorder: string
  mottoQuote: string
}

const DEFAULT_THEME: TeamThemeConfig = {
  primary: '#2074D5',
  purseBg: 'bg-[#15458F]',
  purseHex: '#15458F',
  purseText: 'text-white',
  buttonTextColor: '#FFFFFF',
  glow: 'rgba(32, 116, 213, 0.45)',
  accentBorder: 'border-[#2074D5]/50',
  mottoQuote: 'SAME // GAME // DIFFERENT // BREED',
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
    mottoQuote: 'PRIDE // LOYALTY // YELLOW // FOREVER',
  },
  MI: {
    primary: '#005DAA',
    purseBg: 'bg-[#004BA0]',
    purseHex: '#004BA0',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(0, 93, 170, 0.45)',
    accentBorder: 'border-[#005DAA]/50',
    mottoQuote: 'PRIDE // POWER // DOMINANCE // LEGACY',
  },
  RCB: {
    primary: '#EC1C24',
    purseBg: 'bg-[#B8151B]',
    purseHex: '#B8151B',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(236, 28, 36, 0.45)',
    accentBorder: 'border-[#EC1C24]/50',
    mottoQuote: 'PLAY // BOLD // RED // ARMY',
  },
  KKR: {
    primary: '#3A225D',
    purseBg: 'bg-[#3A225D]',
    purseHex: '#3A225D',
    purseText: 'text-[#F9CD05]',
    buttonTextColor: '#F9CD05',
    glow: 'rgba(58, 34, 93, 0.45)',
    accentBorder: 'border-[#3A225D]/50',
    mottoQuote: 'KORBO // LORBO // JEETBO // RE',
  },
  SRH: {
    primary: '#F26522',
    purseBg: 'bg-[#C7480C]',
    purseHex: '#C7480C',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(242, 101, 34, 0.45)',
    accentBorder: 'border-[#F26522]/50',
    mottoQuote: 'ORANGE // ARMY // RISE // UP',
  },
  DC: {
    primary: '#17479E',
    purseBg: 'bg-[#0E357E]',
    purseHex: '#0E357E',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(23, 71, 158, 0.45)',
    accentBorder: 'border-[#17479E]/50',
    mottoQuote: 'ROAR // MACHA // BLUE // SQUAD',
  },
  RR: {
    primary: '#EA1B86',
    purseBg: 'bg-[#BA1168]',
    purseHex: '#BA1168',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(234, 27, 134, 0.45)',
    accentBorder: 'border-[#EA1B86]/50',
    mottoQuote: 'HALLA // BOL // ROYAL // PINK',
  },
  GT: {
    primary: '#1B2133',
    purseBg: 'bg-[#1B2133]',
    purseHex: '#1B2133',
    purseText: 'text-[#B89B5E]',
    buttonTextColor: '#B89B5E',
    glow: 'rgba(27, 33, 51, 0.45)',
    accentBorder: 'border-[#1B2133]/50',
    mottoQuote: 'AAVA // DE // TITANS // SPIRIT',
  },
  LSG: {
    primary: '#A72056',
    purseBg: 'bg-[#781438]',
    purseHex: '#781438',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(167, 32, 86, 0.45)',
    accentBorder: 'border-[#A72056]/50',
    mottoQuote: 'NAWABI // AMBITION // FEARLESS // ROAR',
  },
  PBKS: {
    primary: '#ED1B24',
    purseBg: 'bg-[#C4141C]',
    purseHex: '#C4141C',
    purseText: 'text-white',
    buttonTextColor: '#FFFFFF',
    glow: 'rgba(237, 27, 36, 0.45)',
    accentBorder: 'border-[#ED1B24]/50',
    mottoQuote: 'PASSION // PRIDE // BELIEF // RISE',
  },
}

export function TeamConsole({
  roomId,
  teamId,
  initialSnapshot,
  roomPlayers = [],
}: {
  roomId: string
  teamId: string
  initialSnapshot: PublicSnapshot
  roomPlayers?: RoomPlayerItem[]
}) {
  const [outbid, setOutbid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [passedLotId, setPassedLotId] = useState<string | null>(null)
  const leaderRef = useRef(initialSnapshot.currentLot?.currentBiddingTeamId ?? null)
  const outbidTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Interactive modal states
  const [showFranchiseDropdown, setShowFranchiseDropdown] = useState(false)
  const [showSquadModal, setShowSquadModal] = useState(false)
  const [showPlayersModal, setShowPlayersModal] = useState(false)
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerRoleFilter, setPlayerRoleFilter] = useState<string>('ALL')
  const [previewPlayer, setPreviewPlayer] = useState<RoomPlayerItem | null>(null)
  const [soldTrigger, setSoldTrigger] = useState<number>(0)
  const lastLotStatusRef = useRef(initialSnapshot.currentLot?.status)

  const { snapshot } = useLiveSnapshot(roomId, initialSnapshot, getPublicSnapshot, (event) => {
    if (event.type === 'SOLD') {
      setSoldTrigger((t) => t + 1)
    }
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
  })

  // Trigger celebration if snapshot lot transitions to SOLD
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
  const passed = !!lot && passedLotId === lot.id

  const nextBid = lot
    ? lot.status === 'BIDDING'
      ? getNextBidAmount(lot.currentBid, lot.player.basePrice)
      : lot.currentBid
    : 0

  const rejection = lot
    ? bidRejectionReason(team, lot, nextBid)
    : 'No active lot'


  const canBid = !closed && !leading && !passed && !pending && !rejection && !!lot

  useEffect(() => {
    leaderRef.current = lot?.currentBiddingTeamId ?? null
  }, [lot?.currentBiddingTeamId])

  useEffect(() => () => clearTimeout(outbidTimer.current), [])

  async function raisePaddle() {
    if (!canBid || !lot) return
    setPending(true)
    setError(null)
    try {
      await placeBid(roomId, teamId, nextBid)
      setOutbid(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bid rejected')
    } finally {
      setPending(false)
    }
  }

  // Spacebar triggers BID
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== ' ') return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return
      e.preventDefault()
      raisePaddle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // Bidding status message for keyboard / status feedback
  const statusMessage = leading
    ? 'you hold the highest bid'
    : passed
    ? 'sitting this lot out'
    : !lot || closed
    ? 'waiting for the auctioneer'
    : rejection === 'Purse insufficient'
    ? 'purse insufficient'
    : rejection
    ? rejection
    : null

  // Role and set category formatting
  const roleDisplay = (lot?.player.role || 'BATTER').replace('_', ' ').toUpperCase()
  const setCategory = lot?.player.setNumber
    ? lot.player.setNumber.toLowerCase().includes('uncapped')
      ? 'UNCAPPED PLAYERS'
      : `${lot.player.setNumber.toUpperCase()} PLAYERS`
    : 'UNCAPPED PLAYERS'

  // Photo resolution with fallback
  const photo = lot?.player.photoUrl || (
    lot?.player.name.toLowerCase().includes('dhoni')
      ? '/players/csk-mahendra-singh-dhoni.png'
      : lot?.player.name.toLowerCase().includes('kohli')
      ? '/players/rcb-virat-kohli.png'
      : lot?.player.name.toLowerCase().includes('rohit')
      ? '/players/mi-rohit-sharma.png'
      : null
  )

  const teamCode = team.shortCode.toUpperCase()
  const theme = TEAM_THEMES[teamCode] || DEFAULT_THEME
  const teamBgSvg = `/assets/teams/${teamCode.toLowerCase()}-team-bg.svg`

  // Filter room players for the PLAYERS modal
  const filteredRoomPlayers = roomPlayers.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(playerSearch.toLowerCase())
    if (!matchesSearch) return false
    if (playerRoleFilter === 'ALL') return true
    const r = p.role.toUpperCase()
    if (playerRoleFilter === 'BATTER') return r.includes('BAT')
    if (playerRoleFilter === 'BOWLER') return r.includes('BOWL')
    if (playerRoleFilter === 'ALL_ROUNDER') return r.includes('ALL')
    if (playerRoleFilter === 'WICKET_KEEPER') return r.includes('WICKET') || r === 'WK'
    return true
  })

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0d0d0f] text-white select-none overflow-x-hidden">
      {/* Environmental Architectural Backdrop */}
      <picture className="fixed inset-0 z-0 h-full w-full pointer-events-none select-none">
        {teamCode === 'CSK' && <source srcSet="/assets/teams/csk-team-bg.webp" type="image/webp" />}
        <source srcSet={teamBgSvg} type="image/svg+xml" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={teamBgSvg}
          alt={`${team.name} War Room Architecture`}
          className="h-full w-full object-cover object-left-top opacity-95 pointer-events-none select-none"
        />
      </picture>
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-r from-transparent via-black/35 to-black/75" />

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
                setShowPlayersModal(false)
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
            <button
              onClick={() => {
                document.getElementById('bidding-panel')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="px-3 py-4 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              BIDDING
            </button>
            <button
              onClick={() => setShowPlayersModal(true)}
              className="px-3 py-4 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              PLAYERS
            </button>
            <button
              onClick={() => setShowAnalyticsModal(true)}
              className="px-3 py-4 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              ANALYTICS
            </button>
          </nav>
        </div>

        {/* Right side: Franchise Selector & User Avatar */}
        <div className="flex items-center gap-3 relative">
          <div className="relative">
            <button
              onClick={() => setShowFranchiseDropdown((prev) => !prev)}
              className="flex items-center gap-2 border bg-[#1C1C20] hover:bg-[#242429] px-3 py-1.5 font-condensed text-sm font-bold uppercase tracking-wider text-white shadow-sm transition-colors cursor-pointer"
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
              <span className="text-white/40 text-xs ml-1">⌄</span>
            </button>

            {/* Franchise Dropdown Menu */}
            {showFranchiseDropdown && (
              <div className="absolute right-0 mt-1 w-64 border border-white/20 bg-[#16161A] p-2 shadow-2xl z-50 flex flex-col gap-1 backdrop-blur-md">
                <span className="font-mono text-[9px] font-black uppercase tracking-wider text-white/50 px-2 py-1 border-b border-white/10">
                  SWITCH TEAM CONSOLE
                </span>
                <div className="max-h-64 overflow-y-auto flex flex-col gap-1 pr-1">
                  {snapshot.teams.map((t) => (
                    <Link
                      key={t.id}
                      href={`/team/${roomId}/${t.id}`}
                      onClick={() => setShowFranchiseDropdown(false)}
                      className={`flex items-center justify-between px-2 py-1.5 text-xs font-condensed uppercase tracking-wider hover:bg-white/10 transition-colors ${
                        t.id === team.id ? 'bg-white/15 text-white font-bold' : 'text-white/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <TeamCrest
                          shortCode={t.shortCode}
                          name={t.name}
                          colorAccent={t.colorAccent}
                          logoUrl={t.logoUrl}
                          mark
                          className="h-4 w-4"
                        />
                        <span>{t.shortCode}</span>
                      </div>
                      <span className="font-mono text-[10px] text-brand-yellow tabular-nums">
                        {formatMoney(t.purseRemaining)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div
            className="h-8 w-8 rounded-full border bg-[#222226] flex items-center justify-center font-mono text-xs font-bold"
            style={{ borderColor: `${theme.primary}60`, color: theme.primary }}
          >
            {team.shortCode.slice(0, 2)}
          </div>
        </div>
      </header>

      {/* ── Main Composition: Left Architectural Flag Pillar + Main War Room ── */}
      <div className="relative z-10 grid flex-1 grid-cols-1 lg:grid-cols-[230px_1fr] xl:grid-cols-[250px_1fr] min-h-0">
        {/* ── Left Pillar: Next Lot Space with Expandable Cricketer Card ── */}
        <aside className="hidden lg:flex flex-col justify-between border-r border-white/10 p-4 bg-black/20 select-none">
          {/* Vertical Cricketer Card fitting the Next Lot Space */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
                ACTIVE LOT CARD
              </span>
              <span className="font-mono text-[9px] font-bold text-brand-yellow">
                LIVE STATS
              </span>
            </div>

            {lot ? (
              <CricketerCard
                player={lot.player}
                teamColor={theme.primary}
                teamName={team.name}
              />
            ) : (
              <div className="flex flex-col items-center justify-center border border-white/15 bg-[#141417]/80 p-6 text-center backdrop-blur-md">
                <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                  NEXT LOT QUEUE
                </span>
                <p className="mt-2 font-condensed text-base font-bold uppercase text-white/70">
                  Awaiting Lot Call
                </p>
              </div>
            )}
          </div>

          {/* Bottom Concrete Architectural Slogan */}
          <div className="pt-4 border-t border-white/10">
            <span className="font-condensed text-xs font-black uppercase leading-tight tracking-wider text-white/35 block">
              SAME
              <br />
              GAME
              <br />
              DIFFERENT
              <br />
              BREED
            </span>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6 min-h-0">
          {/* Top Row: Team Name & Monumental Hero Metrics Plates (Reference 3) */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h1 className="font-condensed text-4xl sm:text-5xl font-black uppercase tracking-tight text-white leading-none">
                {team.name}
              </h1>
              <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                OFFICIAL FRANCHISE WAR ROOM
              </p>
            </div>

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

              {/* ROUND */}
              <div className="flex flex-col border border-white/15 bg-[#17171A] px-4 py-2.5 shadow-sm">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                  ROUND
                </span>
                <span className="font-condensed text-2xl sm:text-3xl font-black text-white leading-none mt-0.5 tabular-nums">
                  {snapshot.room.round || 1}
                </span>
              </div>
            </div>
          </div>

          {/* Top Grid: Active Player Card & Bidding Details | Bidding Control Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
            {/* ── Active Player & Bidding Details Card ── */}
            <div className="border border-white/10 bg-[#141417]/85 p-3.5 backdrop-blur-md shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-[190px_1fr] gap-4 h-full">
                {/* Framed Player Photo with Glowing Accent & Click to Expand */}
                <div
                  className="group relative border-2 bg-[#0E0E11] overflow-hidden flex items-center justify-center min-h-[220px] cursor-pointer"
                  style={{
                    borderColor: theme.primary,
                    boxShadow: `0 0 15px ${theme.glow}`,
                  }}
                  onClick={() => lot && setPreviewPlayer(lot.player as unknown as RoomPlayerItem)}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt={lot ? lot.player.name : 'Player'}
                      className="h-full w-full object-cover object-top filter contrast-[1.05] transition-transform duration-500 group-hover:scale-105"
                    />
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
                    <span>EXPAND STATS</span>
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

                  {/* Sub-Layout: CURRENT BID & 2x2 Grid | PERFORMANCE GRAPH */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1fr] gap-3 flex-1">
                    {/* Left: CURRENT BID Plate & 2x2 Info Grid */}
                    <div className="flex flex-col justify-between gap-2.5">
                      {/* CURRENT BID Plate (Vibrant Pink) */}
                      <div className="bg-[#EB547C] p-3 text-white shadow-[0_0_20px_rgba(235,84,124,0.3)]">
                        <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/85 block">
                          CURRENT BID
                        </span>
                        <div className="font-condensed text-3xl sm:text-4xl font-black leading-none tracking-tight text-white mt-1 tabular-nums">
                          {lot ? formatMoney(lot.currentBid) : '—'}
                        </div>
                      </div>

                      {/* 2x2 Info Grid: TEAM | ROLE | BASE | PURSE */}
                      <div className="grid grid-cols-2 gap-px bg-white/15 border border-white/15">
                        {/* TEAM */}
                        <div className="bg-[#17171A] p-2">
                          <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                            TEAM
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
                            {lot ? roleDisplay : '—'}
                          </span>
                        </div>

                        {/* BASE */}
                        <div className="bg-[#17171A] p-2">
                          <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                            BASE
                          </span>
                          <span className="font-condensed text-xs sm:text-sm font-black uppercase text-brand-yellow truncate block mt-0.5 tabular-nums">
                            {lot ? formatMoney(lot.player.basePrice) : '—'}
                          </span>
                        </div>

                        {/* PURSE */}
                        <div className="bg-[#17171A] p-2">
                          <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                            PURSE
                          </span>
                          <span className="font-condensed text-xs sm:text-sm font-black uppercase text-white truncate block mt-0.5 tabular-nums">
                            {formatMoney(team.purseRemaining)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: PERFORMANCE GRAPH with M, R, W, AVG, SR */}
                    <div className="h-full min-h-[140px]">
                      <PerformanceGraph
                        stats={{
                          matches: lot?.player.matches,
                          runs: lot?.player.runs,
                          wickets: lot?.player.wickets,
                          average: lot?.player.average,
                          strikeRate: lot?.player.strikeRate,
                        }}
                      />
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
              {/* Header */}
              <div className="bg-[#0D0D0F] border-b border-white/10 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                BIDDING CONTROL PANEL
              </div>

              <div className="p-4 flex flex-col justify-between flex-1 gap-3">
                {/* YOUR BIDDING ACTIONS strip */}
                <div className="flex items-center justify-between border border-white/15 bg-[#1C1C20] px-3.5 py-2.5 shadow-inner">
                  <span className="font-mono text-[9px] font-black uppercase tracking-wider text-white/70">
                    YOUR BIDDING ACTIONS
                  </span>
                  <span className="font-condensed text-2xl font-black text-white tabular-nums">
                    {canBid ? formatMoney(nextBid) : formatMoney(lot?.currentBid ?? 0)}
                  </span>
                </div>

                {/* BID Button */}
                <button
                  onClick={raisePaddle}
                  disabled={!canBid}
                  className="flex items-center justify-between px-5 py-3.5 hover:opacity-95 active:scale-[0.99] disabled:opacity-35 disabled:cursor-not-allowed transition-all font-condensed text-2xl font-black uppercase tracking-wider cursor-pointer"
                  style={
                    canBid
                      ? {
                          backgroundColor: theme.primary,
                          color: theme.buttonTextColor || '#FFFFFF',
                          boxShadow: `0 0 20px ${theme.glow}`,
                        }
                      : {
                          backgroundColor: '#2074D5',
                          color: '#FFFFFF',
                        }
                  }
                >
                  <span>BID</span>
                  <Gavel className="h-5 w-5" />
                </button>

                {/* PASS Button */}
                <button
                  onClick={() => lot && setPassedLotId(lot.id)}
                  disabled={!lot || closed || leading || passed}
                  className="flex items-center justify-between px-5 py-3.5 bg-[#EB547C] hover:bg-pink-600 active:bg-pink-700 disabled:opacity-35 disabled:cursor-not-allowed transition-all text-white font-condensed text-2xl font-black uppercase tracking-wider shadow-[0_0_20px_rgba(235,84,124,0.35)] cursor-pointer"
                >
                  <span>PASS</span>
                  <Hand className="h-5 w-5" />
                </button>

                {/* WITHDRAW Button (Disabled per rules) */}
                <button
                  disabled
                  title="A placed bid cannot be retracted per Official IPL Rulebook Clause 4.2"
                  className="flex items-center justify-between px-5 py-3.5 bg-[#E8D9B8] text-[#554C38] cursor-not-allowed font-condensed text-2xl font-black uppercase tracking-wider opacity-85"
                >
                  <span>WITHDRAW</span>
                  <X className="h-5 w-5" />
                </button>

                {/* Press Space to Raise & Live Status Feedback */}
                <div className="pt-1 flex flex-wrap items-center justify-between gap-1 border-t border-white/10 mt-1">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/50">
                    PRESS SPACE TO RAISE
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

          {/* Bottom Grid: YOUR TEAM STATUS | BIDDING LOG */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
            {/* Left: YOUR TEAM STATUS (Slots Grid) */}
            <div className="flex flex-col border border-white/10 bg-[#141417]/85 backdrop-blur-md shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between bg-[#0D0D0F] border-b border-white/10 px-4 py-2">
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                  YOUR TEAM STATUS
                </span>
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-white/60">
                  PURSE {formatMoney(team.purseRemaining).toUpperCase()} • SQUAD {team.squadCount}/{team.squadMax}
                </span>
              </div>

              {/* Slots Grid: 4 or 5 rows of 5 slots */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-3.5">
                {Array.from({ length: team.squadMax || 25 }).map((_, idx) => {
                  const slotNum = idx + 1
                  const player = team.squad[idx]
                  return (
                    <div
                      key={slotNum}
                      className={`border px-3 py-2 min-h-[38px] flex items-center justify-between transition-colors ${
                        player
                          ? 'border-white/30 bg-[#202024] text-white shadow-sm'
                          : 'border-white/10 bg-[#151518] text-white/40'
                      }`}
                    >
                      {player ? (
                        <>
                          <span className="font-condensed text-xs font-bold uppercase text-white truncate max-w-[95px]">
                            {player.name}
                          </span>
                          <span className="font-mono text-[9px] text-brand-yellow font-black tabular-nums">
                            {formatMoney(player.price)}
                          </span>
                        </>
                      ) : (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/40">
                          Slot {slotNum}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: BIDDING LOG */}
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
                          {bid.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Hairline Rule with Team Slogan (Reference 3 Aesthetic) */}
          <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 hidden sm:inline">
              IPL AUCTION PROTOCOL // TEAM CONSOLE
            </span>

            <span
              className="font-mono text-[10px] uppercase tracking-widest font-bold ml-auto"
              style={{ color: `${theme.primary}CC` }}
            >
              {theme.mottoQuote}
            </span>
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

      {/* ── PLAYERS ROSTER MODAL ── */}
      <AnimatePresence>
        {showPlayersModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl border border-white/20 bg-[#141417] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-4">
                <div>
                  <h3 className="font-condensed text-2xl font-black uppercase text-white">
                    AUCTION PLAYER POOL ({roomPlayers.length})
                  </h3>
                  <p className="font-mono text-xs text-white/50">
                    Search and inspect player profiles across all categories
                  </p>
                </div>
                <button
                  onClick={() => setShowPlayersModal(false)}
                  className="p-1 text-white/60 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search & Category Filter */}
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                  <input
                    type="text"
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    placeholder="Search player by name..."
                    className="w-full bg-[#1C1C20] border border-white/15 pl-9 pr-3 py-2 text-sm text-white font-mono placeholder:text-white/30 focus:border-white/50 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px] uppercase font-bold overflow-x-auto pb-1">
                  {['ALL', 'BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'].map((role) => (
                    <button
                      key={role}
                      onClick={() => setPlayerRoleFilter(role)}
                      className={`px-2.5 py-2 border transition-colors cursor-pointer ${
                        playerRoleFilter === role
                          ? 'border-brand-yellow bg-brand-yellow/20 text-white font-black'
                          : 'border-white/10 bg-[#1C1C20] text-white/50 hover:text-white'
                      }`}
                    >
                      {role.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Players Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto pr-1">
                {filteredRoomPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPreviewPlayer(p)
                      setShowPlayersModal(false)
                    }}
                    className="flex items-center justify-between border border-white/10 bg-[#1C1C20] hover:border-white/40 p-2 text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate max-w-[170px]">
                      <div className="h-7 w-7 bg-black border border-white/15 flex items-center justify-center font-condensed font-bold text-xs text-white/60 shrink-0">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="font-condensed text-xs font-bold uppercase text-white truncate block group-hover:text-brand-yellow">
                          {p.name}
                        </span>
                        <span className="font-mono text-[8px] text-white/40 block">
                          {p.role.replace('_', ' ')} • {p.status}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] font-black text-brand-yellow tabular-nums shrink-0">
                      {formatMoney(p.basePrice)}
                    </span>
                  </button>
                ))}
              </div>
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
              className="relative w-full max-w-xl border border-white/20 bg-[#141417] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-4">
                <div>
                  <h3 className="font-condensed text-2xl font-black uppercase text-white">
                    {team.name} WAR ROOM ANALYTICS
                  </h3>
                  <p className="font-mono text-xs text-white/50">
                    Purse liquidity, slot reservation, and valuation telemetry
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
                    PURSE REMAINING
                  </span>
                  <span className="font-condensed text-2xl font-black text-brand-yellow tabular-nums mt-0.5 block">
                    {formatMoney(team.purseRemaining)}
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

                <div className="border border-white/10 bg-[#1A1A1E] p-3.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/40 block">
                    MAXIMUM SINGLE BID
                  </span>
                  <span className="font-condensed text-2xl font-black text-[#EB547C] tabular-nums mt-0.5 block">
                    {formatMoney(
                      Math.max(0, team.purseRemaining - Math.max(0, team.squadMax - team.squadCount - 1) * 20)
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between text-xs font-mono text-white/60 mb-2">
                  <span>SQUAD CAPACITY FILLED</span>
                  <span>
                    {team.squadCount} / {team.squadMax} Slots ({Math.round((team.squadCount / team.squadMax) * 100)}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-brand-yellow transition-all duration-500"
                    style={{ width: `${(team.squadCount / team.squadMax) * 100}%` }}
                  />
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
                <div className="relative aspect-[3/4] w-48 shrink-0 overflow-hidden border-2 border-brand-yellow bg-black shadow-xl">
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

                  <div className="grid grid-cols-3 gap-2">
                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        BASE PRICE
                      </span>
                      <span className="font-condensed text-lg font-black text-brand-yellow tabular-nums">
                        {formatMoney(previewPlayer.basePrice)}
                      </span>
                    </div>

                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        MATCHES
                      </span>
                      <span className="font-condensed text-lg font-black text-white tabular-nums">
                        {previewPlayer.matches ?? 0}
                      </span>
                    </div>

                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        RUNS
                      </span>
                      <span className="font-condensed text-lg font-black text-white tabular-nums">
                        {previewPlayer.runs ?? 0}
                      </span>
                    </div>

                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        WICKETS
                      </span>
                      <span className="font-condensed text-lg font-black text-white tabular-nums">
                        {previewPlayer.wickets ?? 0}
                      </span>
                    </div>

                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        AVERAGE
                      </span>
                      <span className="font-condensed text-lg font-black text-white tabular-nums">
                        {previewPlayer.average ? previewPlayer.average.toFixed(1) : '—'}
                      </span>
                    </div>

                    <div className="border border-white/10 bg-[#1A1A1E] p-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
                        STRIKE RATE
                      </span>
                      <span className="font-condensed text-lg font-black text-brand-blue tabular-nums">
                        {previewPlayer.strikeRate ? previewPlayer.strikeRate.toFixed(1) : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="h-28 border border-white/10">
                    <PerformanceGraph
                      stats={{
                        matches: previewPlayer.matches,
                        runs: previewPlayer.runs,
                        wickets: previewPlayer.wickets,
                        average: previewPlayer.average,
                        strikeRate: previewPlayer.strikeRate,
                      }}
                    />
                  </div>
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
              'OUTBID — COUNTER NOW'
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player Sold Celebration Animation Overlay */}
      <SoldCelebration trigger={soldTrigger} />
    </div>
  )
}
