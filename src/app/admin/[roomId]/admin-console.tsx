'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  X,
  Undo2,
  Pause,
  Play,
  RotateCcw,
  AlertTriangle,
  Circle,
  HelpCircle,
} from 'lucide-react'
import { TeamCrest } from '@/components/ui/team-crest'
import { SoldCelebration } from '@/components/auction/sold-celebration'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { getNextBidAmount, bidRejectionReason } from '@/lib/bid-rules'
import { formatMoney } from '@/lib/money'
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

// Standard order of teams matching Screenshot 1:
// Row 1: PBKS, MI, LSG, KKR, DC
// Row 2: GT, CSK, SRH, RCB, RR
const ORDERED_TEAM_CODES = [
  'PBKS', 'MI', 'LSG', 'KKR', 'DC',
  'GT', 'CSK', 'SRH', 'RCB', 'RR',
]

const TEAM_ACCENTS: Record<string, { bg: string; text: string }> = {
  PBKS: { bg: 'bg-[#ED1B24]', text: 'text-white' },
  MI: { bg: 'bg-[#004BA0]', text: 'text-white' },
  LSG: { bg: 'bg-[#8C1844]', text: 'text-white' },
  KKR: { bg: 'bg-[#3A225D]', text: 'text-white' },
  DC: { bg: 'bg-[#15458F]', text: 'text-white' },
  GT: { bg: 'bg-[#101C2F]', text: 'text-[#D4AF37]' },
  CSK: { bg: 'bg-[#F9CD05]', text: 'text-[#0D0D0F]' },
  SRH: { bg: 'bg-[#D44A0E]', text: 'text-white' },
  RCB: { bg: 'bg-[#B8151B]', text: 'text-white' },
  RR: { bg: 'bg-[#C91370]', text: 'text-white' },
}

export function AdminConsole({
  roomId,
  initialSnapshot,
}: {
  roomId: string
  initialSnapshot: AdminSnapshot
}) {
  const [soldTrigger, setSoldTrigger] = useState<number>(0)
  const lastLotStatusRef = useRef(initialSnapshot.currentLot?.status)

  const { snapshot, setSnapshot } = useLiveSnapshot(roomId, initialSnapshot, getAdminSnapshot, (event) => {
    if (event.type === 'SOLD') {
      setSoldTrigger((t) => t + 1)
    }
  })
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [disputeMessage, setDisputeMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jumpBid, setJumpBid] = useState('')
  const [jumpTeamId, setJumpTeamId] = useState('')
  const [pending, setPending] = useState(false)

  // Watch for lot status transitioning to SOLD
  useEffect(() => {
    const currentStatus = snapshot.currentLot?.status
    if (lastLotStatusRef.current !== 'SOLD' && currentStatus === 'SOLD') {
      setSoldTrigger((t) => t + 1)
    }
    lastLotStatusRef.current = currentStatus
  }, [snapshot.currentLot?.status])

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

  async function handleJumpBid(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(jumpBid)
    if (!amount || amount <= 0) {
      setError('Please enter a valid bid amount')
      return
    }
    await run(() => forceBid(roomId, effectiveJumpTeamId, amount))
    setJumpBid('')
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

  // Sort teams in standard order matching Reference 1
  const sortedTeams = [...snapshot.teams].sort((a, b) => {
    const idxA = ORDERED_TEAM_CODES.indexOf(a.shortCode.toUpperCase())
    const idxB = ORDERED_TEAM_CODES.indexOf(b.shortCode.toUpperCase())
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
  })

  const roleDisplay = (lot?.player.role || 'BATTER').replace('_', ' ').toUpperCase()
  const setCategory = lot?.player.setNumber
    ? lot.player.setNumber.toUpperCase()
    : 'UNCAPPED PLAYERS'

  const remainingPlayersCount = snapshot.queue.length || 253

  // Performance graph stats
  const m = lot?.player.matches ?? 0
  const r = lot?.player.runs ?? 0
  const w = lot?.player.wickets ?? 0
  const avg = lot?.player.average ?? 0
  const sr = lot?.player.strikeRate ?? 0

  const mHeight = m > 0 ? Math.min(95, Math.max(12, Math.round((m / 250) * 90))) : 8
  const rHeight = r > 0 ? Math.min(95, Math.max(12, Math.round((r / 5000) * 90))) : 8
  const wHeight = w > 0 ? Math.min(95, Math.max(12, Math.round((w / 150) * 90))) : 8
  const avgHeight = avg > 0 ? Math.min(95, Math.max(12, Math.round((avg / 50) * 90))) : 8
  const srHeight = sr > 0 ? Math.min(95, Math.max(12, Math.round((sr / 180) * 90))) : 8

  const graphItems = [
    { label: 'M', value: m, height: mHeight, color: 'bg-[#2074D5]' },
    { label: 'R', value: r, height: rHeight, color: 'bg-[#F9D47B]' },
    { label: 'W', value: w, height: wHeight, color: 'bg-[#EB547C]' },
    { label: 'AVG', value: avg, height: avgHeight, color: 'bg-white' },
    { label: 'SR', value: sr, height: srHeight, color: 'bg-[#2074D5]' },
  ]

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0D0D10] text-white select-none overflow-x-hidden font-sans">
      {/* Background Architectural Grid Pattern matching Reference 1 */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]" />

      {/* ── Top Bar (Exact Match to Screenshot 1) ── */}
      <header className="relative z-10 flex flex-wrap items-center justify-between border-b border-white/15 bg-[#121215]/95 px-4 md:px-6 py-3 backdrop-blur-md">
        <div>
          <h1 className="font-condensed text-2xl sm:text-3xl font-black uppercase tracking-tight text-white leading-none">
            ADMIN SUPER-CONTROL PANEL: {snapshot.room.name || roomId.toUpperCase()}
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-2 sm:mt-0">
          {/* Top Row Links matching Reference 1 */}
          <div className="flex items-center gap-4 font-mono text-[11px] font-bold tracking-wider">
            <button
              onClick={() => setShowSetupModal(true)}
              className="text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              SETUP
            </button>
            <span className="text-white/40">•</span>
            <span className="text-white/80">
              ROUND {snapshot.room.round} • {remainingPlayersCount} PLAYERS LEFT
            </span>
            <span className="text-white/40">•</span>
            <Link
              href="/rooms"
              className="text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              ALL ROOMS
            </Link>
          </div>

          {/* System Security Pill & Phase Indicator */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/50">
              SYSTEM SECURITY: ADMIN ACCESS ONLY
            </span>
            {/* Required by test suite */}
            <div className="ml-2 border border-brand-yellow/30 bg-[#1C1C20] px-2 py-0.5 font-mono text-[10px] font-black uppercase text-brand-yellow flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow animate-pulse" />
              <span>{snapshot.room.phase}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Dashboard Body ── */}
      <div className="relative z-10 flex flex-1 flex-col gap-4 p-4 md:p-6 min-w-0">
        {/* Error Toast */}
        {error && (
          <div className="border border-brand-pink bg-[#EB547C] px-4 py-2 text-white font-mono text-xs font-black uppercase flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Dispute Message Banner */}
        {disputeMessage && (
          <div className="border border-brand-yellow bg-[#F9CD05] px-4 py-2 text-black font-mono text-xs font-black uppercase flex items-center justify-between shadow-lg">
            <span>{disputeMessage}</span>
            <button onClick={() => setDisputeMessage(null)} className="cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Top 3-Column Grid (Screenshot 1 Exact Layout) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_310px] xl:grid-cols-[260px_1fr_340px] gap-4">
          {/* ──── Column 1: LOT RESOLUTION & JUMP BID ──── */}
          <div className="flex flex-col gap-4">
            {/* Box 1: LOT RESOLUTION */}
            <div className="flex flex-col border border-white/15 bg-[#141418]/90 p-3.5 shadow-xl backdrop-blur-md">
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mb-2.5 block">
                LOT RESOLUTION
              </span>

              <div className="flex flex-col gap-2">
                {/* SOLD Button */}
                <button
                  onClick={() => run(() => markSold(roomId))}
                  disabled={!lot || closed || pending}
                  className="flex items-center justify-between px-4 py-3 bg-[#60A5FA] hover:bg-blue-400 active:bg-blue-500 disabled:opacity-35 disabled:cursor-not-allowed text-[#0B1528] font-condensed text-xl font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  <span>SOLD</span>
                  <Check className="h-5 w-5 stroke-[3]" />
                </button>

                {/* UNSOLD Button */}
                <button
                  onClick={() => run(() => markUnsold(roomId))}
                  disabled={!lot || closed || pending}
                  className="flex items-center justify-between px-4 py-3 bg-[#F43F5E] hover:bg-rose-600 active:bg-rose-700 disabled:opacity-35 disabled:cursor-not-allowed text-white font-condensed text-xl font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  <span>UNSOLD</span>
                  <X className="h-5 w-5 stroke-[3]" />
                </button>

                {/* UNDO BID Button */}
                <button
                  onClick={() => run(() => undoLastBid(roomId))}
                  disabled={!lot || pending || lot.bidHistory.length === 0}
                  className="flex items-center justify-between px-4 py-3 bg-[#FBBF24] hover:bg-amber-400 active:bg-amber-500 disabled:opacity-35 disabled:cursor-not-allowed text-[#1E1705] font-condensed text-xl font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  <span>UNDO BID</span>
                  <Undo2 className="h-5 w-5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Box 2: JUMP BID */}
            <form
              onSubmit={handleJumpBid}
              className="flex flex-col border border-white/15 bg-[#141418]/90 p-3.5 shadow-xl backdrop-blur-md"
            >
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mb-2.5 block">
                JUMP BID
              </span>

              <div className="flex flex-col gap-2.5">
                <div>
                  <label
                    htmlFor="jump-team"
                    className="font-mono text-[9px] font-bold uppercase tracking-wider text-white/50 block mb-1"
                  >
                    TEAM
                  </label>
                  <select
                    id="jump-team"
                    aria-label="Team"
                    value={effectiveJumpTeamId}
                    onChange={(e) => setJumpTeamId(e.target.value)}
                    className="w-full border border-white/20 bg-[#1C1C22] px-3 py-2 font-condensed text-sm font-bold uppercase tracking-wider text-white focus:border-[#2074D5] focus:outline-none"
                  >
                    {sortedTeams.map((t) => (
                      <option key={t.id} value={t.id} className="bg-[#1C1C22] text-white">
                        {t.shortCode} - {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="jump-amount"
                    className="font-mono text-[9px] font-bold uppercase tracking-wider text-white/50 block mb-1"
                  >
                    AMOUNT
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="jump-amount"
                      aria-label="Amount"
                      type="number"
                      placeholder="e.g. 100"
                      value={jumpBid}
                      onChange={(e) => setJumpBid(e.target.value)}
                      className="flex-1 border border-white/20 bg-[#1C1C22] px-3 py-2 font-mono text-sm font-bold text-white placeholder-white/30 focus:border-[#2074D5] focus:outline-none tabular-nums"
                    />
                    <button
                      type="submit"
                      disabled={!lot || closed || pending}
                      className="px-4 py-2 bg-[#60A5FA] hover:bg-blue-400 active:bg-blue-500 disabled:opacity-35 disabled:cursor-not-allowed font-condensed text-base font-black uppercase tracking-wider text-[#0B1528] transition-colors cursor-pointer shadow"
                    >
                      Bid
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* ──── Column 2: Active Player Card (Screenshot 1 Centerpiece) ──── */}
          <div className="border border-white/15 bg-[#141418]/90 p-4 shadow-2xl backdrop-blur-md flex flex-col">
            {lot ? (
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 h-full">
                {/* Framed Player Photo with Glowing Blue Accent */}
                <div className="relative border-2 border-[#2074D5] bg-[#0E0E11] overflow-hidden flex items-center justify-center min-h-[220px] shadow-[0_0_15px_rgba(32,116,213,0.25)]">
                  {lot.player.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={lot.player.photoUrl}
                      alt={lot.player.name}
                      className="h-full w-full object-cover object-top filter contrast-[1.05]"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 text-center p-4">
                      <span className="font-condensed text-5xl font-black text-white/20">
                        {lot.player.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                        {lot.player.nationality}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Player Name Banner & Sub-Layout */}
                <div className="flex flex-col justify-between gap-3">
                  {/* Solid Blue Player Header Banner */}
                  <div className="bg-[#2074D5] px-4 py-2.5 text-white shadow-md">
                    <h2 className="font-condensed text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none truncate">
                      {lot.player.name}
                    </h2>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/80 mt-1">
                      {setCategory} • {roleDisplay}
                    </p>
                  </div>

                  {/* Sub-Layout: CURRENT BID & 2x2 Grid | PERFORMANCE GRAPH */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1fr] gap-3 flex-1">
                    {/* Left: CURRENT BID Plate & 2x2 Info Grid */}
                    <div className="flex flex-col justify-between gap-2.5">
                      {/* CURRENT BID Plate (Vibrant Pink matching Screenshot 1) */}
                      <div className="bg-[#EB547C] p-3 text-white shadow-[0_0_20px_rgba(235,84,124,0.3)]">
                        <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/85 block">
                          CURRENT BID
                        </span>
                        <div className="font-condensed text-3xl sm:text-4xl font-black leading-none tracking-tight text-white mt-1 tabular-nums">
                          {formatMoney(lot.currentBid)}
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
                            {roleDisplay}
                          </span>
                        </div>

                        {/* BASE */}
                        <div className="bg-[#17171A] p-2">
                          <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                            BASE
                          </span>
                          <span className="font-condensed text-xs sm:text-sm font-black uppercase text-brand-yellow truncate block mt-0.5 tabular-nums">
                            {formatMoney(lot.player.basePrice)}
                          </span>
                        </div>

                        {/* PURSE */}
                        <div className="bg-[#17171A] p-2">
                          <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                            PURSE
                          </span>
                          <span className="font-condensed text-xs sm:text-sm font-black uppercase text-white truncate block mt-0.5 tabular-nums">
                            {formatMoney(leader?.purseRemaining ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: PERFORMANCE GRAPH with M, R, W, AVG, SR */}
                    <div className="flex h-full flex-col justify-between border border-white/10 bg-[#161619] p-3">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/50 block mb-1">
                        PERFORMANCE GRAPH
                      </span>

                      <div className="flex flex-1 items-end justify-between gap-1.5 px-1 pb-1 pt-2">
                        {graphItems.map((item) => (
                          <div
                            key={item.label}
                            className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end group"
                          >
                            <span className="font-mono text-[8px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                              {item.value}
                            </span>
                            <div className="w-full max-w-[22px] bg-white/5 flex items-end h-24 sm:h-28 border-b border-white/15">
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
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center border-2 border-dashed border-white/15">
                <span className="font-condensed text-3xl font-black uppercase tracking-wider text-white/40">
                  NO LOT ON THE BLOCK
                </span>
                <p className="font-mono text-xs text-white/50 mt-1">
                  Click [START LOT] to load the next player onto the stage.
                </p>
                <button
                  onClick={() => run(() => advanceToNextLot(roomId))}
                  disabled={pending}
                  className="mt-4 px-6 py-2.5 bg-[#FBBF24] hover:bg-amber-400 text-black font-condensed text-lg font-black uppercase tracking-wider cursor-pointer shadow-md"
                >
                  START NEXT LOT
                </button>
              </div>
            )}
          </div>

          {/* ──── Column 3: ADMIN SIMULATION CONTROLS & BIDDING LOG ──── */}
          <div className="flex flex-col gap-4">
            {/* Box 1: ADMIN SIMULATION CONTROLS */}
            <div className="flex flex-col border border-white/15 bg-[#141418]/90 p-3.5 shadow-xl backdrop-blur-md">
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mb-2.5 block">
                ADMIN SIMULATION CONTROLS
              </span>

              {/* 2x2 Grid of Actions matching Screenshot 1 */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* [START LOT] */}
                <button
                  onClick={() => run(() => advanceToNextLot(roomId))}
                  disabled={pending}
                  className="px-3 py-2.5 bg-[#1C1C22] border border-white/20 hover:bg-white/10 active:bg-white/15 text-brand-yellow font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center"
                >
                  [START LOT]
                </button>

                {/* [PAUSE] / [RESUME] */}
                <button
                  onClick={() => run(() => controlTimer(roomId, paused ? 'start' : 'pause'))}
                  disabled={!lot || closed || pending}
                  className="px-3 py-2.5 bg-[#1C1C22] border border-white/20 hover:bg-white/10 active:bg-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  {paused ? <Play className="h-3.5 w-3.5 text-brand-yellow" /> : <Pause className="h-3.5 w-3.5 text-white" />}
                  <span>{paused ? '[RESUME]' : '[PAUSE]'}</span>
                </button>

                {/* [RESET TIMER] */}
                <button
                  onClick={() => run(() => controlTimer(roomId, 'reset'))}
                  disabled={!lot || closed || pending}
                  className="px-3 py-2.5 bg-[#1C1C22] border border-white/20 hover:bg-white/10 active:bg-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-white/70" />
                  <span>[RESET TIMER]</span>
                </button>

                {/* [DISPUTE] */}
                <button
                  onClick={() => {
                    setDisputeMessage(`Dispute flagged for Lot ${lot?.id ?? 'current'}. Reverting to previous bid ladder.`)
                    run(() => undoLastBid(roomId))
                  }}
                  disabled={!lot || pending}
                  className="px-3 py-2.5 bg-[#1C1C22] border border-white/20 hover:bg-white/10 active:bg-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center"
                >
                  [DISPUTE]
                </button>
              </div>

              {/* Full-width END AUCTION Button */}
              <button
                onClick={() => setShowEndConfirm(true)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-[#FBBF24] hover:bg-amber-400 active:bg-amber-500 text-black font-condensed text-xl font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                <span>END AUCTION</span>
                <Circle className="h-4 w-4 stroke-[3]" />
              </button>
            </div>

            {/* Box 2: BIDDING LOG */}
            <div className="flex flex-col border border-white/15 bg-[#141418]/90 p-3.5 shadow-xl backdrop-blur-md flex-1 min-h-[160px]">
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mb-2 block">
                BIDDING LOG
              </span>

              <div className="flex-1 overflow-y-auto max-h-[150px] flex flex-col justify-center">
                {!lot?.bidHistory || lot.bidHistory.length === 0 ? (
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-white/40 text-center my-auto">
                    NO BIDS ON THIS LOT YET
                  </span>
                ) : (
                  <div className="flex flex-col gap-1.5 w-full">
                    {[...lot.bidHistory].reverse().map((bid, i) => (
                      <div
                        key={`${bid.teamId}-${bid.timestamp}-${i}`}
                        className="flex items-center justify-between border border-white/10 bg-[#1C1C22] px-2.5 py-1 text-xs"
                      >
                        <span className="font-condensed font-black uppercase text-brand-yellow truncate max-w-[95px]">
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
        </div>

        {/* ── Bottom Row: TEAM BID TRACKER (Screenshot 1 Full Width 2x5 Grid) ── */}
        <div className="flex flex-col border border-white/15 bg-[#141418]/90 p-3.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
              TEAM BID TRACKER
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-white/40">
              CLICK ANY TEAM TO RAISE NEXT BID ({formatMoney(nextBid)})
            </span>
          </div>

          {/* 10 Teams in 2 Rows x 5 Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {sortedTeams.map((team) => {
              const accent = TEAM_ACCENTS[team.shortCode.toUpperCase()] || {
                bg: 'bg-[#2074D5]',
                text: 'text-white',
              }
              const isLeading = leaderId === team.id

              return (
                <button
                  key={team.id}
                  data-testid={`bid-${team.shortCode}`}
                  onClick={() => bidFor(team)}
                  disabled={!lot || closed || pending}
                  className={`group flex flex-col border transition-all text-left overflow-hidden disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer ${
                    isLeading
                      ? 'border-brand-yellow ring-2 ring-brand-yellow shadow-[0_0_15px_rgba(249,205,5,0.4)]'
                      : 'border-white/15 hover:border-white/40 hover:shadow-lg'
                  }`}
                >
                  {/* Top Team Flag Banner */}
                  <div
                    className={`${accent.bg} ${accent.text} px-3 py-2 flex items-center justify-between shadow-sm`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <TeamCrest
                        shortCode={team.shortCode}
                        name={team.name}
                        colorAccent={team.colorAccent}
                        logoUrl={team.logoUrl}
                        mark
                        className="h-5 w-5 object-contain"
                      />
                      <span className="font-condensed text-base font-black uppercase tracking-wider">
                        {team.shortCode}
                      </span>
                    </div>

                    {isLeading && (
                      <span className="font-mono text-[8px] font-black px-1.5 py-0.5 bg-black/40 text-white rounded">
                        LEAD
                      </span>
                    )}
                  </div>

                  {/* Bottom Stats: Purse & Squad Count */}
                  <div
                    data-testid={`purse-${team.shortCode}`}
                    className="flex items-center justify-between bg-[#1A1A1E] px-3 py-2 font-mono text-xs border-t border-white/10"
                  >
                    <span className="font-bold text-white tabular-nums">
                      {formatMoney(team.purseRemaining)}
                    </span>
                    <span className="text-white/50 text-[10px] tabular-nums">
                      {team.squadCount}/{team.squadMax}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── End Auction Confirmation Modal (Required by Test Suite) ── */}
      <AnimatePresence>
        {showEndConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border-2 border-brand-pink bg-[#18181B] p-6 max-w-md w-full shadow-2xl"
            >
              <h2 className="font-condensed text-2xl font-black uppercase text-white mb-2">
                Are you sure you want to end the auction?
              </h2>
              <p className="font-mono text-xs text-white/70 mb-5">
                This will finalize all purchases and complete the auction sitting for this room.
              </p>
              <div className="flex items-center justify-end gap-3 font-condensed text-base font-black uppercase">
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="px-4 py-2 border border-white/20 hover:bg-white/10 text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await run(() => setPhase(roomId, 'COMPLETED'))
                    setShowEndConfirm(false)
                  }}
                  className="px-5 py-2 bg-brand-pink text-white hover:bg-pink-600 transition-colors cursor-pointer"
                >
                  End Auction
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Setup Info Modal ── */}
      <AnimatePresence>
        {showSetupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border border-white/20 bg-[#18181B] p-6 max-w-lg w-full shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <h3 className="font-condensed text-2xl font-black uppercase text-white">
                  ROOM SETUP & SHORTCUTS
                </h3>
                <button onClick={() => setShowSetupModal(false)} className="text-white/60 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col gap-3 font-mono text-xs text-white/80">
                <div className="flex items-center justify-between bg-white/5 p-2">
                  <span className="font-bold text-brand-yellow">[SPACEBAR]</span>
                  <span>Pause / Resume Timer</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 p-2">
                  <span className="font-bold text-brand-yellow">[S] KEY</span>
                  <span>Mark Current Lot SOLD</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 p-2">
                  <span className="font-bold text-brand-yellow">[U] KEY</span>
                  <span>Mark Current Lot UNSOLD</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 p-2">
                  <span className="font-bold text-brand-yellow">[Z] KEY</span>
                  <span>Undo Last Placed Bid</span>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setShowSetupModal(false)}
                  className="px-5 py-2 bg-[#2074D5] text-white font-condensed font-black uppercase text-sm"
                >
                  GOT IT
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Player Sold Celebration Animation Overlay */}
      <SoldCelebration trigger={soldTrigger} />
    </div>
  )
}
