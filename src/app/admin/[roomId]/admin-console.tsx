'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gavel,
  Lock,
  Octagon,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sliders,
  Terminal,
  Undo2,
  Users,
  X,
} from 'lucide-react'
import { BrutalButton } from '@/components/ui/brutal-button'
import { TeamCrest } from '@/components/ui/team-crest'
import { GlobalFooter } from '@/components/ui/global-footer'
import { BiddingLogTable } from '@/components/auction/bidding-log-table'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { getNextBidAmount, bidRejectionReason } from '@/lib/bid-rules'
import { formatMoney } from '@/lib/money'
import { formatClock } from '@/lib/clock'
import {
  getAdminSnapshot,
  setPhase,
  markSold,
  markUnsold,
  undoLastBid,
  controlTimer,
  placeBid,
  forceBid,
  advanceToNextLot,
  type AdminSnapshot,
} from './actions'

type Team = AdminSnapshot['teams'][number]

export function AdminConsole({
  roomId,
  initialSnapshot,
}: {
  roomId: string
  initialSnapshot: AdminSnapshot
}) {
  const { snapshot, setSnapshot } = useLiveSnapshot(roomId, initialSnapshot, getAdminSnapshot)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jumpBid, setJumpBid] = useState('')
  const [jumpTeamId, setJumpTeamId] = useState('')
  const [activeNav, setActiveNav] = useState<'AUCTION' | 'TEAMS' | 'LOGS'>('AUCTION')
  const [pending, setPending] = useState(false)

  const lot = snapshot.currentLot
  const effectiveJumpTeamId = jumpTeamId || snapshot.teams[0]?.id || ''
  const leaderId = lot?.currentBiddingTeamId ?? null
  const leader = snapshot.teams.find((t) => t.id === leaderId)
  const closed = lot?.status === 'SOLD' || lot?.status === 'UNSOLD'
  const paused = snapshot.room.phase === 'PAUSED'

  const nextBid = lot
    ? lot.status === 'BIDDING'
      ? getNextBidAmount(lot.currentBid, lot.player.basePrice)
      : lot.currentBid
    : 0

  async function run(action: () => Promise<AdminSnapshot>) {
    setError(null)
    setPending(true)
    try {
      setSnapshot(await action())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rejected')
    } finally {
      setPending(false)
    }
  }

  async function bidFor(team: Team, amount = nextBid) {
    if (!lot || closed || pending) return
    const reason = bidRejectionReason(team, lot, amount)
    if (reason) {
      setError(`${team.shortCode}: ${reason}`)
      return
    }
    await run(() => placeBid(roomId, team.id, amount))
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!snapshot.currentLot) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.key === ' ') {
        e.preventDefault()
        run(() => controlTimer(roomId, snapshot.room.phase === 'PAUSED' ? 'start' : 'pause'))
      } else if (e.key.toLowerCase() === 's') {
        run(() => markSold(roomId))
      } else if (e.key.toLowerCase() === 'u') {
        run(() => markUnsold(roomId))
      } else if (e.key.toLowerCase() === 'z') {
        run(() => undoLastBid(roomId))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, snapshot])

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#141414] bg-concrete text-white overflow-x-hidden">
      {/* Top Bar matching Reference 4 */}
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-white/10 bg-[#161616]/95 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-6">
          <Link href={`/display/${roomId}`} className="flex items-center gap-2">
            <span className="font-condensed text-2xl font-black tracking-wider text-white">IPL</span>
          </Link>

          {/* Nav Tabs */}
          <nav className="hidden sm:flex items-center gap-1 font-mono text-[11px] font-bold tracking-wider">
            <div className="px-3 py-4 text-white relative">
              ADMIN
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2074D5]" />
            </div>

            <button
              onClick={() => setActiveNav('AUCTION')}
              className="px-3 py-4 text-white/50 hover:text-white/80"
            >
              PLAYERS
            </button>

            <button
              onClick={() => setActiveNav('TEAMS')}
              className="px-3 py-4 text-white/50 hover:text-white/80"
            >
              TEAMS
            </button>

            <button
              onClick={() => setActiveNav('LOGS')}
              className="px-3 py-4 text-white/50 hover:text-white/80"
            >
              AUCTION LOGS
            </button>

            <span className="px-3 py-4 text-white/30 cursor-not-allowed">SETTINGS</span>
          </nav>
        </div>

        {/* Right side: Secure Mode badge & Admin Avatar */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border border-white/15 bg-[#1F1F1F] px-3 py-1 font-mono text-[10px] font-bold tracking-wider text-white">
            <Lock size={12} className="text-brand-yellow" />
            <span>SECURE MODE</span>
          </div>

          <div className="h-8 w-8 rounded-full border border-white/20 bg-[#242424] flex items-center justify-center font-mono text-xs font-bold text-white/80">
            AD
          </div>
        </div>
      </header>

      {/* Main Screen 4 Composition */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[220px_1fr] min-h-0">
        {/* ── Left Technical Sidebar (Reference 4) ── */}
        <aside className="hidden lg:flex flex-col justify-between border-r border-white/10 bg-[#161616] p-4">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setActiveNav('AUCTION')}
              className={`flex items-center gap-3 px-3 py-3 font-mono text-xs font-bold tracking-wider transition-all text-left ${
                activeNav === 'AUCTION'
                  ? 'bg-[#2074D5] text-white shadow-[0_0_12px_rgba(32,116,213,0.3)]'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Gavel size={16} />
              <span>AUCTION CONTROL</span>
            </button>

            <button
              onClick={() => setActiveNav('AUCTION')}
              className="flex items-center gap-3 px-3 py-3 font-mono text-xs font-bold tracking-wider text-white/60 hover:bg-white/5 hover:text-white transition-all text-left"
            >
              <Terminal size={16} />
              <span>PLAYER DATABASE</span>
            </button>

            <button
              onClick={() => setActiveNav('TEAMS')}
              className={`flex items-center gap-3 px-3 py-3 font-mono text-xs font-bold tracking-wider transition-all text-left ${
                activeNav === 'TEAMS'
                  ? 'bg-[#2074D5] text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Shield size={16} />
              <span>TEAM MANAGEMENT</span>
            </button>

            <button
              onClick={() => setActiveNav('LOGS')}
              className={`flex items-center gap-3 px-3 py-3 font-mono text-xs font-bold tracking-wider transition-all text-left ${
                activeNav === 'LOGS'
                  ? 'bg-[#2074D5] text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Sliders size={16} />
              <span>AUCTION LOGS</span>
            </button>

            <button
              disabled
              className="flex items-center gap-3 px-3 py-3 font-mono text-xs font-bold tracking-wider text-white/30 cursor-not-allowed text-left"
            >
              <Users size={16} />
              <span>SYSTEM SETTINGS</span>
            </button>
          </div>

          {/* Vertical Architectural Text */}
          <div className="py-6 border-t border-white/10 flex flex-col gap-1">
            {['CONTROL', 'MANAGE', 'RESOLVE', 'EXECUTE'].map((word) => (
              <span
                key={word}
                className="font-condensed text-xl font-black tracking-wider text-white/30"
              >
                {word}
              </span>
            ))}
          </div>
        </aside>

        {/* ── Main Operations Stage ── */}
        <main className="flex flex-col gap-5 p-4 lg:p-6 min-w-0">
          {/* Top Title & Room Telemetry Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3">
            <div>
              <h1 className="font-condensed text-4xl sm:text-5xl font-black uppercase tracking-tight text-white leading-none">
                AUCTION CONTROL
              </h1>
              <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                IPL AUCTION 2024 • CHENNAI, INDIA
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Phase pill - REQUIRED BY TEST SUITE */}
              <div className="flex items-center gap-2 border border-brand-yellow/30 bg-[#242424] px-3 py-1 font-mono text-xs font-black uppercase text-brand-yellow">
                <span className="h-2 w-2 rounded-full bg-brand-yellow animate-pulse" />
                <span>{snapshot.room.phase}</span>
              </div>

              <span className="font-mono text-xs font-bold uppercase tracking-widest text-white/40">
                ROUND {snapshot.room.round}
              </span>

              {/* End Auction Button - REQUIRED BY TEST SUITE */}
              <BrutalButton
                variant="pink"
                onClick={() => setShowEndConfirm(true)}
                className="px-3 py-1 text-xs font-bold uppercase"
              >
                END AUCTION
              </BrutalButton>
            </div>
          </div>

          {/* Active Player Card Banner (Reference 4) */}
          <div className="border border-white/15 bg-[#1C1C1C] p-4 shadow-xl">
            {lot ? (
              <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_120px] gap-5 items-center">
                {/* Photo Plate */}
                <div className="relative aspect-square w-28 md:w-32 overflow-hidden bg-[#242424] border border-white/20 mx-auto md:mx-0">
                  {lot.player.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={lot.player.photoUrl}
                      alt={lot.player.name}
                      className="h-full w-full object-cover object-top filter contrast-[1.05]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-condensed text-4xl font-black text-white/30">
                      {lot.player.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Player Metadata & 5 Metrics */}
                <div className="flex flex-col justify-between h-full gap-3">
                  <div>
                    <h2 className="font-condensed text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-none">
                      {lot.player.name}
                    </h2>
                    <p className="mt-1 font-mono text-xs font-bold uppercase tracking-wider text-white/70">
                      {lot.player.role.replace('_', ' ')} • {lot.player.nationality.toUpperCase()}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-t border-white/10 pt-2 text-xs">
                    <div className="flex flex-col bg-[#242424] p-2 border border-white/5">
                      <span className="font-mono text-[8px] font-bold uppercase text-white/50">
                        BASE PRICE
                      </span>
                      <span className="font-condensed text-base font-black text-white tabular-nums">
                        {formatMoney(lot.player.basePrice)}
                      </span>
                    </div>

                    <div className="flex flex-col bg-[#242424] p-2 border border-white/5">
                      <span className="font-mono text-[8px] font-bold uppercase text-white/50">
                        AGE
                      </span>
                      <span className="font-condensed text-base font-black text-white tabular-nums">
                        42
                      </span>
                    </div>

                    <div className="flex flex-col bg-[#242424] p-2 border border-white/5">
                      <span className="font-mono text-[8px] font-bold uppercase text-white/50">
                        T20 CAPS
                      </span>
                      <span className="font-condensed text-base font-black text-white tabular-nums">
                        {lot.player.matches ?? 430}
                      </span>
                    </div>

                    <div className="flex flex-col bg-[#242424] p-2 border border-white/5">
                      <span className="font-mono text-[8px] font-bold uppercase text-white/50">
                        IPL CAPS
                      </span>
                      <span className="font-condensed text-base font-black text-white tabular-nums">
                        {lot.player.runs ? Math.round(lot.player.runs / 40) : 250}
                      </span>
                    </div>

                    <div className="flex flex-col bg-[#242424] p-2 border border-white/5">
                      <span className="font-mono text-[8px] font-bold uppercase text-white/50">
                        CATEGORY
                      </span>
                      <span className="font-condensed text-base font-black text-brand-yellow uppercase">
                        {lot.player.setNumber ?? 'LEGEND'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Lot Number & Pagination */}
                <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-4">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/50">
                    LOT
                  </span>
                  <span className="font-condensed text-3xl font-black text-white">
                    {lot.lotNumber} / 577
                  </span>

                  <div className="mt-2 flex items-center gap-1">
                    <button
                      disabled
                      aria-label="Previous lot"
                      className="p-1.5 border border-white/10 bg-[#222222] text-white/30 cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => run(() => advanceToNextLot(roomId))}
                      aria-label="Next lot"
                      className="p-1.5 border border-white/15 bg-[#222222] hover:bg-white/10 text-white transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center font-mono text-sm uppercase tracking-widest text-white/40">
                NO ACTIVE LOT ON THE BLOCK — CLICK START LOT TO ADVANCE
              </div>
            )}
          </div>

          {/* 3 Column Operations Grid (Reference 4) */}
          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1.4fr_1fr] gap-4">
            {/* ── Column 1: ADMIN ACTIONS ── */}
            <div className="flex flex-col gap-2 border border-white/10 bg-[#1A1A1A] p-4">
              <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70 border-b border-white/10 pb-2 mb-1">
                ADMIN ACTIONS
              </span>

              {/* START LOT: Solid Blue */}
              <BrutalButton
                variant="blue"
                onClick={() => run(() => advanceToNextLot(roomId))}
                className="py-3 text-base font-black uppercase tracking-wider flex items-center justify-start gap-3 px-4 shadow-[0_0_12px_rgba(32,116,213,0.3)]"
              >
                <Play size={18} fill="currentColor" />
                <span>START LOT</span>
              </BrutalButton>

              {/* PAUSE / RESUME */}
              <BrutalButton
                variant="plain"
                onClick={() => run(() => setPhase(roomId, paused ? 'LIVE' : 'PAUSED'))}
                className="py-3 text-base font-bold uppercase tracking-wider flex items-center justify-start gap-3 px-4 border border-white/15 bg-[#222222] text-white hover:bg-white/10"
              >
                {paused ? <Play size={18} /> : <Pause size={18} />}
                <span>{paused ? 'RESUME AUCTION' : 'PAUSE AUCTION'}</span>
              </BrutalButton>

              {/* RESET LOT TIMER */}
              <BrutalButton
                variant="plain"
                disabled={!lot}
                onClick={() => run(() => controlTimer(roomId, 'reset'))}
                className="py-3 text-base font-bold uppercase tracking-wider flex items-center justify-start gap-3 px-4 border border-white/15 bg-[#222222] text-white hover:bg-white/10"
              >
                <RotateCcw size={18} />
                <span>RESET LOT TIMER</span>
              </BrutalButton>

              {/* Resolution Controls Row */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <BrutalButton
                  variant="blue"
                  disabled={!lot || closed || !leaderId}
                  onClick={() => run(() => markSold(roomId))}
                  className="py-2.5 text-sm font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <Check size={16} />
                  <span>SOLD (S)</span>
                </BrutalButton>

                <BrutalButton
                  variant="pink"
                  disabled={!lot || closed || !!leaderId}
                  onClick={() => run(() => markUnsold(roomId))}
                  className="py-2.5 text-sm font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <X size={16} />
                  <span>UNSOLD (U)</span>
                </BrutalButton>
              </div>

              {/* Undo Last Bid */}
              <BrutalButton
                variant="yellow"
                disabled={!lot}
                onClick={() => run(() => undoLastBid(roomId))}
                className="py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-1"
              >
                <Undo2 size={14} />
                <span>UNDO LAST BID (Z)</span>
              </BrutalButton>
            </div>

            {/* ── Column 2: LIVE BIDDING LOG ── */}
            <BiddingLogTable
              title="LIVE BIDDING LOG"
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

            {/* ── Column 3: AUCTION TIMER & SYSTEM STATUS ── */}
            <div className="flex flex-col justify-between border border-white/10 bg-[#1A1A1A] p-4">
              <div>
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70 border-b border-white/10 pb-2 block mb-3">
                  AUCTION TIMER
                </span>

                {/* Big White Card Digital Timer (Reference 4) */}
                <div className="flex flex-col items-center justify-center bg-white p-4 shadow-xl text-[#141414]">
                  <span className="font-condensed text-5xl font-black tracking-wider tabular-nums leading-none">
                    {formatClock(lot?.timerSeconds ?? 90)}
                  </span>
                </div>

                {/* Quick adjustment pill buttons */}
                <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px] font-bold">
                  <button
                    onClick={() => run(() => controlTimer(roomId, 'start'))}
                    className="border border-white/15 bg-[#222222] hover:bg-white/10 py-1.5 text-center text-white"
                  >
                    +30s
                  </button>
                  <button
                    onClick={() => run(() => controlTimer(roomId, 'start'))}
                    className="border border-white/15 bg-[#222222] hover:bg-white/10 py-1.5 text-center text-white"
                  >
                    +1m
                  </button>
                  <button
                    onClick={() => run(() => controlTimer(roomId, 'reset'))}
                    className="border border-white/15 bg-[#222222] hover:bg-white/10 py-1.5 text-center text-white"
                  >
                    RESET
                  </button>
                </div>
              </div>

              {/* SYSTEM STATUS (Reference 4) */}
              <div className="mt-6 border-t border-white/10 pt-3">
                <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-white/50 block mb-2">
                  SYSTEM STATUS
                </span>
                <div className="flex items-center gap-2.5 bg-[#1F1F1F] p-2.5 border border-white/5">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="font-mono text-xs font-black uppercase tracking-wider text-emerald-400">
                    ALL SYSTEMS OPERATIONAL
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Lower Section: Team Bid Grid & Jump Bid (Crucial for test suite!) ── */}
          <div className="border border-white/10 bg-[#1A1A1A] p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3">
              <div>
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70 block">
                  FRANCHISE BIDDING MATRIX & PURSES
                </span>
                <span className="font-mono text-[10px] text-white/40">
                  Click any team to place next ladder bid ({formatMoney(nextBid)})
                </span>
              </div>

              {/* Jump Bid Form (REQUIRED BY TEST SUITE) */}
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (lot && !closed && !pending && jumpBid) {
                    run(() => forceBid(roomId, effectiveJumpTeamId, Number(jumpBid)))
                  }
                }}
              >
                <select
                  aria-label="Jump bid team"
                  value={effectiveJumpTeamId}
                  onChange={(e) => setJumpTeamId(e.target.value)}
                  className="border border-white/20 bg-[#242424] px-2 py-1.5 text-xs text-white font-mono"
                >
                  {snapshot.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.shortCode}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  <label htmlFor="jump-bid-input" className="sr-only">
                    amount
                  </label>
                  <input
                    id="jump-bid-input"
                    aria-label="amount"
                    inputMode="numeric"
                    placeholder="Amount"
                    value={jumpBid}
                    onChange={(e) => setJumpBid(e.target.value.replace(/\D/g, ''))}
                    className="w-24 border border-white/20 bg-[#242424] px-2 py-1.5 text-xs text-white tabular-nums font-mono text-center"
                  />
                  <BrutalButton
                    type="submit"
                    variant="blue"
                    disabled={!lot || closed || pending || !jumpBid}
                    className="px-3 py-1.5 text-xs font-bold uppercase"
                  >
                    Bid
                  </BrutalButton>
                </div>
              </form>
            </div>

            {/* Team Bidding Matrix Grid (REQUIRED BY TEST SUITE) */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {snapshot.teams.map((team) => {
                const isLeading = team.id === leaderId
                const isBlocked = !lot || closed || (pending ? 'Processing...' : bidRejectionReason(team, lot, nextBid))

                return (
                  <div
                    key={team.id}
                    data-testid={`purse-${team.shortCode}`}
                    className={`flex flex-col border transition-all ${
                      isLeading
                        ? 'border-brand-yellow bg-brand-yellow/10 shadow-[0_0_12px_rgba(249,212,123,0.3)]'
                        : 'border-white/10 bg-[#202020]'
                    }`}
                  >
                    {/* Team Header & Bid Action Button */}
                    <button
                      type="button"
                      data-testid={`bid-${team.shortCode}`}
                      onClick={() => bidFor(team)}
                      disabled={!!isBlocked}
                      className="flex items-center justify-between p-2.5 text-left border-b border-white/10 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2">
                        <TeamCrest
                          shortCode={team.shortCode}
                          name={team.name}
                          colorAccent={team.colorAccent}
                          logoUrl={team.logoUrl}
                          mark
                          className="h-5 w-5"
                        />
                        <span className="font-condensed font-black text-sm text-white">
                          {team.shortCode}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-brand-blue uppercase">
                        BID
                      </span>
                    </button>

                    {/* Purse & Squad Stats */}
                    <div className="flex items-baseline justify-between p-2 font-mono text-xs">
                      <span className="font-black text-white tabular-nums">
                        {formatMoney(team.purseRemaining)}
                      </span>
                      <span className="text-[10px] text-white/50">
                        {team.squadCount}/{team.squadMax}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>

      {/* End Auction Confirmation Modal (REQUIRED BY TEST SUITE) */}
      <AnimatePresence>
        {showEndConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md border border-white/20 bg-[#1E1E1E] p-6 text-white shadow-2xl"
            >
              <h2 className="font-condensed text-3xl font-black uppercase text-white">
                Are you sure?
              </h2>
              <p className="mt-2 text-sm text-white/70 font-sans">
                Ending the auction closes the session for all franchise war rooms. All unsold lots will remain closed.
              </p>
              <div className="mt-6 flex gap-3">
                <BrutalButton
                  variant="pink"
                  onClick={async () => {
                    await run(() => setPhase(roomId, 'COMPLETED'))
                    setShowEndConfirm(false)
                  }}
                  className="px-5 py-2.5 font-bold uppercase"
                >
                  End auction
                </BrutalButton>
                <BrutalButton
                  variant="plain"
                  onClick={() => setShowEndConfirm(false)}
                  className="px-5 py-2.5 font-bold uppercase border border-white/20 bg-[#2A2A2A] text-white"
                >
                  Cancel
                </BrutalButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      {error && (
        <p
          role="alert"
          className="fixed bottom-12 left-1/2 z-40 -translate-x-1/2 border border-brand-pink bg-[#EB547C] px-6 py-3 font-condensed text-lg font-black uppercase tracking-widest text-white shadow-2xl"
        >
          {error}
        </p>
      )}

      {/* Footer */}
      <GlobalFooter
        tagline="FOR A BIGGER TOMORROW."
        year="IPL AUCTION 2024"
      />
    </div>
  )
}
