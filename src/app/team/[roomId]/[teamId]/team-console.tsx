'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Gavel, Hand, TriangleAlert, X, Shield, ArrowRight, Check } from 'lucide-react'
import { BrutalButton } from '@/components/ui/brutal-button'
import { TeamCrest } from '@/components/ui/team-crest'
import { GlobalHeader } from '@/components/ui/global-header'
import { GlobalFooter } from '@/components/ui/global-footer'
import { LiveAuctionHero } from '@/components/auction/live-auction-hero'
import { CircularCountdown } from '@/components/auction/circular-countdown'
import { BiddingLogTable } from '@/components/auction/bidding-log-table'
import { PurseBreakdownDonut } from '@/components/auction/purse-breakdown-donut'
import { RolesFilledProgress } from '@/components/auction/roles-filled-progress'
import { CurrentSquadTable } from '@/components/auction/current-squad-table'
import { bidRejectionReason, getNextBidAmount } from '@/lib/bid-rules'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { formatMoney } from '@/lib/money'
import { getPublicSnapshot, placeBid, type PublicSnapshot } from '@/app/admin/[roomId]/actions'

export function TeamConsole({
  roomId,
  teamId,
  initialSnapshot,
}: {
  roomId: string
  teamId: string
  initialSnapshot: PublicSnapshot
}) {
  const [activeTab, setActiveTab] = useState<'WARROOM' | 'BIDDING'>('WARROOM')
  const [outbid, setOutbid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [passedLotId, setPassedLotId] = useState<string | null>(null)
  const leaderRef = useRef(initialSnapshot.currentLot?.currentBiddingTeamId ?? null)
  const outbidTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { snapshot } = useLiveSnapshot(roomId, initialSnapshot, getPublicSnapshot, (event) => {
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

  const rejection = lot && !closed ? bidRejectionReason(team, lot, nextBid) : null
  const canBid = !!lot && !closed && !rejection && !leading && !passed && !pending

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

  // Spacebar is the paddle.
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

  // Role Breakdown counts
  const batsmenCount = team.squad.filter((p) => p.role.includes('BAT')).length
  const arCount = team.squad.filter((p) => p.role.includes('ALL') || p.role.includes('AR')).length
  const bowlerCount = team.squad.filter((p) => p.role.includes('BOWL')).length
  const wkCount = team.squad.filter((p) => p.role.includes('WICKET') || p.role === 'WK').length

  // Slogan based on team
  const getTeamMotto = (code: string) => {
    switch (code.toUpperCase()) {
      case 'CSK':
        return { words: ['PRIDE', 'LOYALTY', 'YELLOW', 'FOREVER'], quote: 'IN YELLOW WE BELIEVE' }
      case 'MI':
        return { words: ['ONE', 'FAMILY', 'BLUE', 'FOREVER'], quote: 'DUNIYA HILA DENGE HUM' }
      case 'RCB':
        return { words: ['PLAY', 'BOLD', 'ROYAL', 'FOREVER'], quote: 'EE SALA CUP NAMDE' }
      case 'KKR':
        return { words: ['KORBO', 'LORBO', 'JEETBO', 'FOREVER'], quote: 'AMI KKR' }
      case 'DC':
        return { words: ['ROAR', 'MACHA', 'DELHI', 'FOREVER'], quote: 'DIL SE DELHI' }
      default:
        return { words: ['SAME', 'GAME', 'DIFFERENT', 'BREED'], quote: 'TALENT FUELS TOMORROW' }
    }
  }

  const motto = getTeamMotto(team.shortCode)

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#141414] bg-concrete text-white overflow-x-hidden">
      {/* Top Bar with Navigation Tabs matching Reference 3 */}
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-white/10 bg-[#161616]/95 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-6">
          <Link href={`/display/${roomId}`} className="flex items-center gap-2">
            <span className="font-condensed text-2xl font-black tracking-wider text-white">IPL</span>
          </Link>

          {/* Nav Tabs */}
          <nav className="hidden sm:flex items-center gap-1 font-mono text-[11px] font-bold tracking-wider">
            <button
              onClick={() => setActiveTab('WARROOM')}
              className={`px-3 py-4 transition-all relative ${
                activeTab === 'WARROOM'
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              MY TEAM
              {activeTab === 'WARROOM' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2074D5]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('WARROOM')}
              className="px-3 py-4 text-white/50 hover:text-white/80"
            >
              SQUAD
            </button>

            <button
              onClick={() => setActiveTab('BIDDING')}
              className={`px-3 py-4 transition-all relative ${
                activeTab === 'BIDDING'
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              BIDDING
              {activeTab === 'BIDDING' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2074D5]" />
              )}
            </button>

            <span className="px-3 py-4 text-white/30 cursor-not-allowed">PLAYERS</span>
            <span className="px-3 py-4 text-white/30 cursor-not-allowed">ANALYTICS</span>
          </nav>
        </div>

        {/* Right side: Franchise selector & Avatar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-white/15 bg-[#1F1F1F] px-3 py-1.5 font-condensed text-sm font-bold uppercase tracking-wider text-white">
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

          <div className="h-8 w-8 rounded-full border border-white/20 bg-[#242424] flex items-center justify-center font-mono text-xs font-bold text-white/80">
            {team.shortCode.slice(0, 2)}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[220px_1fr] xl:grid-cols-[250px_1fr] gap-6 p-4 lg:p-6 min-h-0">
        {/* ── Left Architectural Banner (Screen 3 Reference) ── */}
        <aside className="hidden lg:flex flex-col justify-between border-r border-white/10 pr-6 py-2">
          <div className="flex flex-col gap-6">
            {/* Waving Team Flag Display */}
            <div className="relative overflow-hidden border border-white/15 bg-[#1C1C1C] p-3 shadow-xl">
              <div
                className="relative h-32 w-full flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: `${team.colorAccent}15` }}
              >
                <div className="absolute -right-4 -bottom-4 opacity-20">
                  <TeamCrest
                    shortCode={team.shortCode}
                    name={team.name}
                    colorAccent={team.colorAccent}
                    logoUrl={team.logoUrl}
                    className="h-32 w-32"
                  />
                </div>

                <div className="z-10 flex flex-col items-center text-center">
                  <TeamCrest
                    shortCode={team.shortCode}
                    name={team.name}
                    colorAccent={team.colorAccent}
                    logoUrl={team.logoUrl}
                    className="h-16 w-16 drop-shadow-lg"
                  />
                  <span className="font-condensed text-lg font-black tracking-wider text-white mt-1">
                    {team.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Architectural Concrete Slogan */}
            <div className="flex flex-col gap-1 py-4">
              {motto.words.map((word) => (
                <span
                  key={word}
                  className="font-condensed text-2xl font-black uppercase leading-tight tracking-wider text-white/40"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>

          <div className="py-4 border-t border-white/10">
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 block">
              FRANCHISE HEADQUARTERS
            </span>
            <span className="font-condensed text-xs font-bold uppercase tracking-wider text-brand-yellow mt-0.5 block">
              {motto.quote}
            </span>
          </div>
        </aside>

        {/* ── Main View (War Room / Bidding) ── */}
        <section className="flex flex-col gap-5 min-w-0">
          {/* Header Row: Team Name & 3 Metrics */}
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
              {/* REMAINING PURSE: Solid Blue Box (Reference 3) */}
              <div className="flex flex-col bg-[#2074D5] px-5 py-3 shadow-[0_0_15px_rgba(32,116,213,0.3)]">
                <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/80">
                  REMAINING PURSE
                </span>
                <span className="font-condensed text-3xl font-black text-white leading-none mt-0.5 tabular-nums">
                  {formatMoney(team.purseRemaining)}
                </span>
              </div>

              {/* SQUAD SIZE */}
              <div className="flex flex-col border border-white/15 bg-[#1C1C1C] px-4 py-3">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                  SQUAD SIZE
                </span>
                <span className="font-condensed text-3xl font-black text-white leading-none mt-0.5 tabular-nums">
                  {team.squadCount} / {team.squadMax}
                </span>
              </div>

              {/* OVERSEAS SLOTS */}
              <div className="flex flex-col border border-white/15 bg-[#1C1C1C] px-4 py-3">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                  OVERSEAS SLOTS
                </span>
                <span className="font-condensed text-3xl font-black text-white leading-none mt-0.5 tabular-nums">
                  {team.overseasSlotsUsed} / {team.overseasSlotsMax}
                </span>
              </div>
            </div>
          </div>

          {/* Active Tab View */}
          {activeTab === 'WARROOM' ? (
            /* ── WAR ROOM (Reference 3 Layout) ── */
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
              {/* Left Column: CURRENT SQUAD Table with Slots */}
              <div className="flex flex-col gap-4">
                <CurrentSquadTable
                  squad={team.squad}
                  squadMax={team.squadMax}
                />
              </div>

              {/* Right Column: PURSE BREAKDOWN & ROLES FILLED */}
              <div className="flex flex-col gap-6">
                <PurseBreakdownDonut
                  purseTotal={team.purseTotal}
                  purseRemaining={team.purseRemaining}
                />

                <RolesFilledProgress
                  batsmen={{ filled: batsmenCount, target: 6 }}
                  allRounders={{ filled: arCount, target: 4 }}
                  bowlers={{ filled: bowlerCount, target: 5 }}
                  wicketkeepers={{ filled: wkCount, target: 2 }}
                />
              </div>
            </div>
          ) : (
            /* ── BIDDING (Reference 2 Live Paddle Layout) ── */
            <div className="flex flex-col gap-4">
              <LiveAuctionHero
                player={lot ? lot.player : null}
                currentBid={lot ? lot.currentBid : 0}
                leaderTeam={leader}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bidding Log */}
                <BiddingLogTable
                  title="BIDDING LOG"
                  rows={[...(lot?.bidHistory ?? [])].reverse().map((bid) => {
                    const t = snapshot.teams.find((tm) => tm.id === bid.teamId)
                    return {
                      key: `${bid.teamId}-${bid.timestamp}`,
                      teamCode: t?.shortCode ?? bid.teamName,
                      teamName: bid.teamName,
                      amount: bid.amount,
                      timestamp: bid.timestamp,
                      accentColor: t?.colorAccent,
                    }
                  })}
                />

                {/* Circular Countdown Timer */}
                <div className="flex flex-col items-center justify-center border border-white/10 bg-[#1A1A1A] p-6 text-center">
                  <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70 block mb-2">
                    LOT COUNTDOWN
                  </span>
                  <CircularCountdown
                    seconds={lot?.timerSeconds ?? null}
                    totalSeconds={30}
                    size={130}
                    strokeWidth={8}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Bidding Paddle Dock: ALWAYS Rendered & Functional (Preserves All Tests & Keyboard Shortcuts!) ── */}
          <div className="mt-2 border border-white/15 bg-[#1B1B1B] p-4 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                  LIVE BIDDING CONTROLS
                </span>
                <span className="h-2 w-2 rounded-full bg-[#2074D5] animate-pulse" />
              </div>

              {/* Status Message */}
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/60">
                {leading
                  ? 'you hold the highest bid'
                  : passed
                  ? 'sitting this lot out'
                  : !lot || closed
                  ? 'waiting for the auctioneer'
                  : rejection === 'Purse insufficient'
                  ? 'purse insufficient'
                  : rejection
                  ? rejection
                  : canBid
                  ? 'Press space to raise'
                  : 'waiting for the auctioneer'}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_1fr] gap-3 items-center">
              {/* Next Bid Rung Stepper */}
              <div className="flex items-center justify-between border border-white/15 bg-[#222222] px-4 py-3">
                <span className="font-mono text-sm uppercase tracking-widest text-white/50">
                  NEXT RUNG
                </span>
                <span className="font-condensed text-2xl font-black text-white tabular-nums">
                  {canBid ? formatMoney(nextBid) : '—'}
                </span>
              </div>

              {/* BID button */}
              <BrutalButton
                variant={outbid ? 'pink' : 'blue'}
                disabled={!canBid}
                onClick={raisePaddle}
                className="py-3 text-xl font-black uppercase tracking-wider"
              >
                BID
              </BrutalButton>

              {/* PASS button */}
              <BrutalButton
                variant="pink"
                disabled={!lot || closed || leading || passed}
                onClick={() => lot && setPassedLotId(lot.id)}
                className="py-3 text-base font-bold uppercase tracking-wider"
              >
                PASS
              </BrutalButton>

              {/* WITHDRAW button (Always disabled per rules) */}
              <BrutalButton
                variant="yellow"
                disabled
                title="A placed bid cannot be retracted"
                className="py-3 text-base font-bold uppercase tracking-wider"
              >
                WITHDRAW
              </BrutalButton>
            </div>
          </div>
        </section>
      </main>

      {/* Outbid / Error Toast */}
      <AnimatePresence>
        {(error || (outbid && !leading)) && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-12 left-1/2 z-40 -translate-x-1/2 border border-brand-pink bg-[#EB547C] px-6 py-3 font-condensed text-lg font-black uppercase tracking-widest text-white shadow-2xl"
          >
            {error ? (
              <span className="flex items-center gap-2">
                <TriangleAlert size={18} aria-hidden /> {error}
              </span>
            ) : (
              'OUTBID — COUNTER NOW'
            )}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Footer */}
      <GlobalFooter
        tagline={motto.quote}
        year="IPL AUCTION 2024"
      />
    </div>
  )
}
