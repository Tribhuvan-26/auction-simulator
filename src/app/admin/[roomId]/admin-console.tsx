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
  SkipForward,
  Repeat,
} from 'lucide-react'
import { RatingTile } from '@/components/auction/rating-panel'
import { LogoutButton } from '@/components/ui/logout-button'
import { logoutAdmin } from '@/lib/pin-actions'
import { TeamCrest } from '@/components/ui/team-crest'
import { LotPhoto } from '@/components/auction/lot-photo'
import { SoldCelebration } from '@/components/auction/sold-celebration'
import { StandingsTable } from '@/components/auction/squad-rules'
import { useLiveSnapshot, type AuctionEvent } from '@/hooks/use-live-snapshot'
import { applyLiveEvent, newer } from '@/lib/live-events'
import { getNextBidAmount, bidRejectionReason } from '@/lib/bid-rules'
import { croreToLakhs, formatMoney } from '@/lib/money'
import { categoryLabel, standings } from '@/lib/team-rules'
import { unwrap, type Rejected } from '@/lib/action-result'
import {
  getAdminSnapshot,
  setPhase,
  markSold,
  markUnsold,
  undoLastBid,
  placeBid,
  forceBid,
  advanceToNextLot,
  moveInQueue,
  recallUnsold,
  sendToUnsold,
  replaySold,
  dropFromLot,
  restartRoom,
  type AdminSnapshot,
  type PublicSnapshot,
  type BidResult,
} from './actions'

type Team = AdminSnapshot['teams'][number]

// The broadcast doesn't carry the queue (it's the auctioneer's alone), and the
// only change another screen can make to it is calling the next lot — which
// takes exactly that player off the front. So apply the new state and drop
// that one player, rather than waiting on a refetch that could get lost.
function applyAdminEvent(prev: AdminSnapshot, event: AuctionEvent) {
  const next = applyLiveEvent(prev, event)
  if (!next || next === prev || event.type !== 'LOT_CHANGE') return next
  const called = event.snapshot.currentLot?.player.id
  return { ...next, queue: next.queue.filter((p) => p.id !== called) }
}

const LIVE_OPTIONS = { applyEvent: applyAdminEvent, versionOf: (s: AdminSnapshot) => s.at }

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

  const { snapshot, setSnapshot } = useLiveSnapshot(roomId, initialSnapshot, getAdminSnapshot, LIVE_OPTIONS)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [showStandings, setShowStandings] = useState(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [disputeMessage, setDisputeMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jumpBid, setJumpBid] = useState('')
  const [jumpTeamId, setJumpTeamId] = useState('')
  const [pending, setPending] = useState(false)

  // The one place the celebration fires: the lot turning SOLD in the snapshot
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
  const ended = snapshot.room.phase === 'COMPLETED'
  // The server refuses bids while paused or ended; grey the buttons to match.
  const biddingOpen = !!lot && !closed && !paused && !ended

  const nextBid = lot
    ? lot.status === 'BIDDING'
      ? getNextBidAmount(lot.currentBid, lot.player.basePrice)
      : lot.currentBid
    : 0

  // A ref as well as state: the keyboard handler closes over an old render, so
  // it reads this to know an action is already in flight.
  const pendingRef = useRef(false)

  async function run(action: () => Promise<AdminSnapshot | PublicSnapshot | BidResult | Rejected>, onDone?: () => void) {
    if (pendingRef.current) return
    pendingRef.current = true
    setError(null)
    setPending(true)
    try {
      const next = unwrap(await action())
      // A bid answers with just the lot, and placeBid's public snapshot has no
      // queue — either way, keep what's on screen for the rest.
      setSnapshot((prev) => newer(prev, next))
      onDone?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rejected')
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  // Plays here straight away; the broadcast replays it on the team seats and
  // the big screen. Nothing changes in the room, so no snapshot comes back.
  function replay() {
    if (lot?.status !== 'SOLD') return
    setSoldTrigger((t) => t + 1)
    replaySold(roomId).then(unwrap).catch((e) => setError(e instanceof Error ? e.message : 'Replay failed'))
  }

  async function bidFor(team: Team, amount = nextBid) {
    if (!lot || !biddingOpen || pending) return
    const reason = bidRejectionReason(team, lot, amount)
    if (reason) {
      setError(`${team.shortCode}: ${reason}`)
      return
    }
    if (pendingRef.current) return
    // Show the bid the moment it's clicked; the server's answer replaces it.
    // A rejected bid puts the lot back as it was right away — not only once a
    // re-read of the room succeeds — unless something newer already landed.
    const optimistic = lot
    const before = snapshot
    setSnapshot((prev) => ({
      ...prev,
      currentLot: {
        ...optimistic,
        status: 'BIDDING',
        currentBid: amount,
        currentBiddingTeamId: team.id,
        activeBidders: optimistic.activeBidders.includes(team.id)
          ? optimistic.activeBidders
          : [...optimistic.activeBidders, team.id],
        bidHistory: [
          ...optimistic.bidHistory,
          { teamId: team.id, teamName: team.name, amount, timestamp: new Date().toISOString() },
        ],
      },
    }))
    await run(async () => {
      try {
        return unwrap(await placeBid(roomId, team.id, amount))
      } catch (e) {
        setSnapshot((prev) => (prev.at === before.at ? { ...prev, currentLot: before.currentLot } : prev))
        getAdminSnapshot(roomId).then((fresh) => setSnapshot((prev) => newer(prev, fresh)), () => {})
        throw e
      }
    })
  }

  const [movePlayerId, setMovePlayerId] = useState('')
  const [movePos, setMovePos] = useState('')

  async function handleMove(e: React.FormEvent) {
    e.preventDefault()
    if (!movePlayerId || !Number(movePos)) return
    await run(() => moveInQueue(roomId, movePlayerId, Number(movePos)), () => setMovePos(''))
  }

  async function handleJumpBid(e: React.FormEvent) {
    e.preventDefault()
    const amount = croreToLakhs(jumpBid)
    if (!(amount > 0)) {
      setError('Enter the bid in crore, e.g. 2.5')
      return
    }
    await run(() => forceBid(roomId, effectiveJumpTeamId, amount), () => setJumpBid(''))
  }

  // An ended auction can be reopened — END is a click away from the others,
  // and a room stuck in COMPLETED refuses every bid.
  function togglePause() {
    run(() => setPhase(roomId, paused || ended ? 'LIVE' : 'PAUSED'))
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // A held key repeats, and Cmd+S / Ctrl+Z are the browser's — neither may
      // sell or undo a lot.
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (showEndConfirm || showSetupModal || showStandings || showRestartConfirm) return
      const lot = snapshot.currentLot
      if (!lot) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      // A clicked button keeps focus, and Space would press it again — but the
      // letter shortcuts must keep working right after clicking a team tile.
      if (target?.tagName === 'BUTTON' && e.key === ' ') return
      const open = lot.status === 'QUEUED' || lot.status === 'BIDDING'
      const key = e.key.toLowerCase()
      if (e.key === ' ') {
        e.preventDefault()
        if (snapshot.room.phase === 'LIVE' || snapshot.room.phase === 'PAUSED') togglePause()
      } else if (key === 's' && open) {
        run(() => markSold(roomId))
      } else if (key === 'u' && open) {
        run(() => markUnsold(roomId))
      } else if (key === 'z') {
        run(() => undoLastBid(roomId))
      } else if (key === 'n' && !open) {
        run(() => advanceToNextLot(roomId))
      } else if (key === 'r' && lot.status === 'SOLD') {
        replay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, snapshot, showEndConfirm, showSetupModal, showStandings, showRestartConfirm])

  // Sort teams in standard order matching Reference 1
  const sortedTeams = [...snapshot.teams].sort((a, b) => {
    const idxA = ORDERED_TEAM_CODES.indexOf(a.shortCode.toUpperCase())
    const idxB = ORDERED_TEAM_CODES.indexOf(b.shortCode.toUpperCase())
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
  })

  const soldColor =
    lot?.status === 'SOLD' ? snapshot.teams.find((t) => t.id === lot.currentBiddingTeamId) ?? null : null
  const roleDisplay = (lot?.player.role || 'BATTER').replace('_', ' ').toUpperCase()
  const setCategory = lot ? categoryLabel(lot.player) : ''

  const remainingPlayersCount = snapshot.queue.length
  // An empty queue brings the unsold back for another round (the server
  // decides whether any team still needs them), so NEXT stays live for that.
  const unsoldCount = snapshot.unsold.length
  const noneLeft = remainingPlayersCount === 0 && unsoldCount === 0

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
            <button
              onClick={() => setShowStandings(true)}
              className="text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              STANDINGS
            </button>
            <span className="text-white/40">•</span>
            <span className="text-white/80">
              {remainingPlayersCount} PLAYERS LEFT
            </span>
            <span className="text-white/40">•</span>
            <Link
              href="/rooms"
              className="text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              ALL ROOMS
            </Link>
            <span className="text-white/40">•</span>
            <LogoutButton
              action={() => logoutAdmin(roomId)}
              className="text-white/70 hover:text-white transition-colors cursor-pointer"
            />
          </div>

          {/* Phase Indicator */}
          <div className="flex items-center gap-2">
            {/* Required by test suite */}
            <div className="border border-brand-yellow/30 bg-[#1C1C20] px-2 py-0.5 font-mono text-[10px] font-black uppercase text-brand-yellow flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow animate-pulse" />
              <span>{snapshot.room.phase}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Dashboard Body ── */}
      <div className="relative z-10 flex flex-1 flex-col gap-4 p-4 md:p-6 min-w-0">
        {/* An ended room refuses bids and NEXT — say so loudly, with the way back. */}
        {ended && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-[#F9CD05] bg-[#F9CD05]/15 px-4 py-3 shadow-lg">
            <span className="font-condensed text-xl font-black uppercase tracking-wider text-[#F9CD05]">
              AUCTION ENDED — bidding is off. NEXT PLAYER or REOPEN carries on
            </span>
            <button
              onClick={togglePause}
              disabled={pending}
              className="flex items-center gap-2 bg-[#F9CD05] px-4 py-2 font-condensed text-lg font-black uppercase tracking-wider text-black hover:bg-yellow-300 disabled:opacity-35 cursor-pointer"
            >
              <Play className="h-4 w-4" />
              REOPEN AUCTION
            </button>
            <button
              onClick={() => setShowRestartConfirm(true)}
              disabled={pending}
              className="flex items-center gap-2 border-2 border-[#F9CD05] px-4 py-2 font-condensed text-lg font-black uppercase tracking-wider text-[#F9CD05] hover:bg-[#F9CD05]/15 disabled:opacity-35 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              START NEW AUCTION
            </button>
          </div>
        )}

        {/* The result, without opening STANDINGS: the best score wins, full squad or not. */}
        {ended && (() => {
          const top = standings(snapshot.teams)[0]
          const winner = top && snapshot.teams.find((t) => t.id === top.teamId)
          return (
            <div data-testid="final-result" className="flex flex-col gap-3 border-2 border-[#F9CD05]/60 bg-[#18181B] p-4 shadow-lg">
              <span className="font-condensed text-3xl font-black uppercase tracking-wider text-[#F9CD05]">
                {winner ? `WINNER: ${winner.name} (${winner.shortCode}) · ${top.score.toFixed(1)}` : 'NO TEAMS IN THIS ROOM'}
              </span>
              <StandingsTable teams={snapshot.teams} />
            </div>
          )
        })()}

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
                  // Undo also walks back a SOLD/UNSOLD call, which an UNSOLD lot has no bids for.
                  disabled={!lot || pending || (!closed && lot.bidHistory.length === 0)}
                  className="flex items-center justify-between px-4 py-3 bg-[#FBBF24] hover:bg-amber-400 active:bg-amber-500 disabled:opacity-35 disabled:cursor-not-allowed text-[#1E1705] font-condensed text-xl font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  <span>UNDO BID</span>
                  <Undo2 className="h-5 w-5 stroke-[2.5]" />
                </button>

                {/* NEXT PLAYER: once the lot is closed, the auctioneer calls the next one. */}
                <button
                  onClick={() => run(() => advanceToNextLot(roomId))}
                  disabled={!closed || pending || noneLeft}
                  className="flex items-center justify-between px-4 py-3 bg-[#34D399] hover:bg-emerald-400 active:bg-emerald-500 disabled:opacity-35 disabled:cursor-not-allowed text-[#05200F] font-condensed text-xl font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  <span>NEXT PLAYER</span>
                  <SkipForward className="h-5 w-5 stroke-[2.5]" />
                </button>

                {/* REPLAY: the sold animation again, on every screen in the room. */}
                <button
                  onClick={replay}
                  disabled={lot?.status !== 'SOLD'}
                  className="flex items-center justify-between px-4 py-3 bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/25 disabled:opacity-35 disabled:cursor-not-allowed text-white font-condensed text-xl font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  <span>REPLAY SOLD</span>
                  <Repeat className="h-5 w-5 stroke-[2.5]" />
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
                    AMOUNT (CR)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="jump-amount"
                      aria-label="Amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 2.5"
                      value={jumpBid}
                      onChange={(e) => setJumpBid(e.target.value)}
                      className="min-w-0 flex-1 border border-white/20 bg-[#1C1C22] px-3 py-2 font-mono text-sm font-bold text-white placeholder-white/30 focus:border-[#2074D5] focus:outline-none tabular-nums"
                    />
                    <button
                      type="submit"
                      disabled={!biddingOpen || pending}
                      className="shrink-0 px-4 py-2 bg-[#60A5FA] hover:bg-blue-400 active:bg-blue-500 disabled:opacity-35 disabled:cursor-not-allowed font-condensed text-base font-black uppercase tracking-wider text-[#0B1528] transition-colors cursor-pointer shadow"
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] gap-4 h-full">
                {/* Framed player photo. Nearly half the card: the row's height comes
                    from the tall left column, so a square this wide fills it
                    instead of leaving a small picture over empty space. */}
                <div className="relative aspect-square w-full self-start border-2 border-[#2074D5] bg-[#0E0E11] overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(32,116,213,0.25)]">
                  {lot.player.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <LotPhoto src={lot.player.photoUrl} alt={lot.player.name} soldTo={soldColor} className="absolute inset-0 overflow-hidden" />
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

                {/* Right: name, then bid + rating, then the details */}
                <div className="flex min-w-0 flex-col gap-3">
                  {/* Solid Blue Player Header Banner */}
                  <div className="bg-[#2074D5] px-4 py-2.5 text-white shadow-md">
                    <h2 className="font-condensed text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none truncate">
                      {lot.player.name}
                    </h2>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/80 mt-1">
                      {setCategory} • {roleDisplay}
                    </p>
                  </div>

                  {/* CURRENT BID with the rating beside it; takes up the spare height */}
                  <div className="grid flex-1 grid-cols-[1fr_auto] gap-3">
                    <div className="flex flex-col justify-center bg-[#EB547C] p-3 text-white shadow-[0_0_20px_rgba(235,84,124,0.3)]">
                      <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/85 block">
                        CURRENT BID
                      </span>
                      <div className="font-condensed text-4xl sm:text-5xl font-black leading-none tracking-tight text-white mt-1 tabular-nums">
                        {formatMoney(lot.currentBid)}
                      </div>
                    </div>
                    <RatingTile name={lot.player.name} />
                  </div>

                  {/* 2x2 Info Grid: TEAM | ROLE | BASE | PURSE */}
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
                        {roleDisplay}
                      </span>
                    </div>

                    {/* BASE */}
                    <div className="bg-[#17171A] p-2">
                      <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                        BASE
                      </span>
                      <span className="font-condensed text-sm sm:text-base font-black uppercase text-brand-yellow truncate block mt-0.5 tabular-nums">
                        {formatMoney(lot.player.basePrice)}
                      </span>
                    </div>

                    {/* PURSE */}
                    <div className="bg-[#17171A] p-2">
                      <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/50 block">
                        PURSE
                      </span>
                      <span className="font-condensed text-sm sm:text-base font-black uppercase text-white truncate block mt-0.5 tabular-nums">
                        {formatMoney(leader?.purseRemaining ?? 0)}
                      </span>
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

            {/* Once the hammer falls, the next step goes where the auctioneer is looking. */}
            {closed && (
              <button
                onClick={() => run(() => advanceToNextLot(roomId))}
                disabled={pending || noneLeft}
                className="mt-4 flex w-full items-center justify-center gap-3 bg-[#34D399] px-6 py-3.5 font-condensed text-2xl font-black uppercase tracking-wider text-[#05200F] shadow-lg transition-all hover:bg-emerald-400 active:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
              >
                {noneLeft ? 'NO PLAYERS LEFT' : remainingPlayersCount === 0 ? `UNSOLD ROUND (${unsoldCount}) [N]` : 'NEXT PLAYER [N]'}
                <SkipForward className="h-6 w-6 stroke-[2.5]" />
              </button>
            )}
          </div>

          {/* ──── Column 3: ADMIN SIMULATION CONTROLS & BIDDING LOG ──── */}
          <div className="flex flex-col gap-4">
            {/* Box 1: ADMIN SIMULATION CONTROLS */}
            <div className="flex flex-col border border-white/15 bg-[#141418]/90 p-3.5 shadow-xl backdrop-blur-md">
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mb-2.5 block">
                ADMIN SIMULATION CONTROLS
              </span>

              {/* START LOT and PAUSE side by side, DISPUTE across the row below */}
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
                  onClick={togglePause}
                  // Nothing to pause before the first lot, and a room paused in
                  // SETUP would stay paused when that lot opens.
                  disabled={pending || snapshot.room.phase === 'SETUP'}
                  className="px-3 py-2.5 bg-[#1C1C22] border border-white/20 hover:bg-white/10 active:bg-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  {paused || ended ? <Play className="h-3.5 w-3.5 text-brand-yellow" /> : <Pause className="h-3.5 w-3.5 text-white" />}
                  <span>{ended ? '[REOPEN]' : paused ? '[RESUME]' : '[PAUSE]'}</span>
                </button>

                {/* [DISPUTE] */}
                <button
                  onClick={() => {
                    if (!lot) return
                    const lotNumber = lot.lotNumber
                    run(() => undoLastBid(roomId), () =>
                      setDisputeMessage(`Dispute flagged for Lot ${lotNumber}. Last bid reverted.`)
                    )
                  }}
                  disabled={!lot || closed || pending || lot.bidHistory.length === 0}
                  className="col-span-2 px-3 py-2.5 bg-[#1C1C22] border border-white/20 hover:bg-white/10 active:bg-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center"
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
                          {new Date(bid.timestamp).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })}
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] xl:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="flex flex-col border border-white/15 bg-[#141418]/90 p-3.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
              TEAM BID TRACKER
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-white/40">
              CLICK ANY TEAM TO RAISE NEXT BID ({formatMoney(nextBid)})
            </span>
          </div>

          {/* The two teams in this lot (first two to press I'M IN, or that you bid
              for). A third can only come in once one of them is dropped. */}
          {lot && !closed && (
            <div className="mb-3 border border-white/15 bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                <span>TEAMS IN · {Math.min(lot.activeBidders.length, 2)}/2</span>
                <span className="text-white/40">
                  {lot.activeBidders.length >= 2 ? 'Others wait until you drop one' : "Waiting for teams to press I'M IN"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[0, 1].map((slot) => {
                  const id = lot.activeBidders[slot]
                  const t = id ? snapshot.teams.find((x) => x.id === id) : undefined
                  if (!t) {
                    return (
                      <div
                        key={slot}
                        className="flex min-h-[72px] items-center justify-center border border-dashed border-white/20 font-mono text-xs font-bold uppercase tracking-widest text-white/35"
                      >
                        Slot {slot + 1} open
                      </div>
                    )
                  }
                  const accent = TEAM_ACCENTS[t.shortCode.toUpperCase()] || { bg: 'bg-[#2074D5]', text: 'text-white' }
                  const isLead = t.id === leaderId
                  return (
                    <div key={t.id} data-testid={`in-${t.shortCode}`} className={`flex min-h-[72px] items-center gap-3 px-3 py-2 ${accent.bg} ${accent.text}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-condensed text-3xl font-black uppercase leading-none">{t.shortCode}</span>
                          {isLead && (
                            <span className="bg-black/70 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-brand-yellow">
                              LEADING
                            </span>
                          )}
                        </div>
                        <div className="truncate font-mono text-[10px] font-bold uppercase tracking-wider opacity-80">
                          {t.name} · {formatMoney(t.purseRemaining)} left
                        </div>
                      </div>
                      {!isLead && (
                        <button
                          onClick={() => bidFor(t)}
                          disabled={!biddingOpen || pending}
                          className="shrink-0 bg-black/70 px-3 py-2 font-condensed text-base font-black uppercase tracking-wider text-white hover:bg-black disabled:opacity-35 cursor-pointer"
                        >
                          BID {formatMoney(nextBid)}
                        </button>
                      )}
                      {!isLead && (
                        <button
                          onClick={() => run(() => dropFromLot(roomId, t.id))}
                          disabled={pending}
                          className="shrink-0 border border-white/60 px-2 py-2 font-mono text-[10px] font-black uppercase tracking-wider hover:bg-black/30 disabled:opacity-35 cursor-pointer"
                        >
                          DROP
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 10 Teams in 2 Rows x 5 Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {sortedTeams.map((team) => {
              const accent = TEAM_ACCENTS[team.shortCode.toUpperCase()] || {
                bg: 'bg-[#2074D5]',
                text: 'text-white',
              }
              const isLeading = leaderId === team.id
              const isIn = !!lot && !closed && lot.activeBidders.includes(team.id)
              const isOut = !!lot && !closed && lot.droppedTeamIds.includes(team.id)
              // Two teams are in (pressed I'M IN or bid): the rest wait for a DROP.
              const lockedOut = !!lot && !closed && lot.activeBidders.length >= 2 && !isIn

              return (
                <button
                  key={team.id}
                  data-testid={`bid-${team.shortCode}`}
                  onClick={() => bidFor(team)}
                  disabled={!biddingOpen || pending || lockedOut || isOut}
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

                    {isLeading ? (
                      <span className="font-mono text-[8px] font-black px-1.5 py-0.5 bg-black/40 text-white rounded">
                        LEAD
                      </span>
                    ) : isIn ? (
                      <span className="font-mono text-[8px] font-black px-1.5 py-0.5 bg-black/40 text-white rounded">
                        IN
                      </span>
                    ) : isOut ? (
                      <span className="font-mono text-[8px] font-black px-1.5 py-0.5 bg-black/60 text-white/60 rounded">
                        OUT
                      </span>
                    ) : null}
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
        {/* UP NEXT QUEUE */}
        <div className="flex flex-col border border-white/15 bg-[#141418]/90 p-3.5 shadow-xl backdrop-blur-md">
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mb-2 block">
            UP NEXT · {snapshot.queue.length} IN QUEUE
          </span>

          {/* Call the unsold now instead of waiting for the queue to run dry. */}
          <button
            onClick={() => run(() => recallUnsold(roomId))}
            disabled={pending || unsoldCount === 0}
            title="Put every unsold player at the front of the queue, and call the first one if nothing is on the block"
            className="mb-2 flex items-center justify-center gap-1.5 border-2 border-[#F97316] bg-[#F97316]/15 px-2 py-1.5 font-condensed text-sm font-black uppercase tracking-wider text-[#FDBA74] hover:bg-[#F97316]/30 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 stroke-[2.5]" />
            BACK TO UNSOLD ({unsoldCount})
          </button>
          {/* Or bring back just one of them. */}
          {unsoldCount > 0 && (
            <div className="mb-2 flex max-h-[120px] flex-col gap-1 overflow-y-auto">
              {snapshot.unsold.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 border border-[#F97316]/30 bg-[#1C1C22] px-2 py-1 text-xs">
                    <span className="flex-1 truncate font-condensed font-black uppercase text-white">{r.name}</span>
                    <button
                      onClick={() => run(() => recallUnsold(roomId, r.id))}
                      disabled={pending}
                      title="Bring this player back: on the block now, or up next if a player is still on the block"
                      className="px-1.5 py-0.5 border border-[#F97316]/60 font-mono text-[9px] font-bold uppercase text-[#FDBA74] hover:bg-white/10 disabled:opacity-35 cursor-pointer"
                    >
                      BRING BACK
                    </button>
                  </div>
                ))}
            </div>
          )}

          <form onSubmit={handleMove} className="flex gap-1.5 mb-2">
            <select
              value={movePlayerId}
              onChange={(e) => setMovePlayerId(e.target.value)}
              aria-label="Player to move"
              className="min-w-0 flex-1 bg-[#1C1C22] border border-white/20 px-2 py-1.5 font-mono text-[11px] text-white"
            >
              <option value="">Player…</option>
              {snapshot.queue.map((p, i) => (
                <option key={p.id} value={p.id}>{i + 1}. {p.name}</option>
              ))}
            </select>
            <input
              value={movePos}
              onChange={(e) => setMovePos(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="Pos"
              aria-label="New queue position"
              className="w-14 bg-[#1C1C22] border border-white/20 px-2 py-1.5 font-mono text-[11px] text-white"
            />
            <button
              type="submit"
              disabled={pending || !movePlayerId || !movePos}
              className="px-3 bg-[#FBBF24] text-black font-mono text-[11px] font-bold uppercase disabled:opacity-40 cursor-pointer"
            >
              MOVE
            </button>
          </form>

          <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
            {snapshot.queue.map((p, i) => (
              <React.Fragment key={p.id}>
              <div
                className={`flex items-center gap-2 border px-2 py-1 text-xs ${
                  i === 0 ? 'border-brand-yellow bg-brand-yellow/10' : 'border-white/10 bg-[#1C1C22]'
                }`}
              >
                <span className="font-mono text-[10px] text-white/40 w-6 tabular-nums">{i + 1}</span>
                <span className="flex-1 truncate font-condensed font-black uppercase text-white">{p.name}</span>
                <span className="font-mono text-[9px] text-white/50">{p.role.replace('_', ' ')}</span>
                <span className="font-mono text-[10px] tabular-nums text-white/70">{formatMoney(p.basePrice)}</span>
                {i > 0 && (
                  <button
                    onClick={() => run(() => moveInQueue(roomId, p.id, 1))}
                    disabled={pending}
                    title="Move this player to the top of the queue"
                    className="px-1.5 py-0.5 border border-white/20 font-mono text-[9px] font-bold uppercase text-brand-yellow hover:bg-white/10 cursor-pointer"
                  >
                    TO TOP
                  </button>
                )}
                <button
                  onClick={() => run(() => advanceToNextLot(roomId, p.id))}
                  disabled={pending || (!!lot && !closed)}
                  title="Put this player on the block now; the rest of the list keeps its order"
                  className="px-1.5 py-0.5 border border-[#34D399]/60 font-mono text-[9px] font-bold uppercase text-[#34D399] hover:bg-white/10 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                >
                  CALL
                </button>
                <button
                  onClick={() => run(() => sendToUnsold(roomId, p.id))}
                  disabled={pending}
                  title="Move this player to the unsold list without calling them"
                  className="px-1.5 py-0.5 border border-[#F97316]/60 font-mono text-[9px] font-bold uppercase text-[#FDBA74] hover:bg-white/10 disabled:opacity-35 cursor-pointer"
                >
                  TO UNSOLD
                </button>
              </div>
              {/* Once the lot is called, bring up the player above straight from the queue. */}
              {i === 0 && closed && (
                <button
                  onClick={() => run(() => advanceToNextLot(roomId))}
                  disabled={pending}
                  className="flex items-center justify-center gap-1.5 bg-[#34D399] px-2 py-1 font-condensed text-sm font-black uppercase tracking-wider text-[#05200F] hover:bg-emerald-400 active:bg-emerald-500 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                >
                  <SkipForward className="h-3.5 w-3.5 stroke-[2.5]" />
                  NEXT PLAYER: {p.name}
                </button>
              )}
              </React.Fragment>
            ))}
          </div>
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
                  onClick={() => run(() => setPhase(roomId, 'COMPLETED'), () => setShowEndConfirm(false))}
                  disabled={pending}
                  className="px-5 py-2 bg-brand-pink text-white hover:bg-pink-600 transition-colors cursor-pointer"
                >
                  End Auction
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Start New Auction Confirmation ── */}
      <AnimatePresence>
        {showRestartConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border-2 border-[#F9CD05] bg-[#18181B] p-6 max-w-md w-full shadow-2xl"
            >
              <h2 className="font-condensed text-2xl font-black uppercase text-white mb-2">Start a new auction?</h2>
              <p className="font-mono text-xs text-white/70 mb-2">
                Every purse goes back to 100 Cr, every squad is emptied, and all players go back in the queue.
                Teams and PINs stay the same.
              </p>
              <p className="font-mono text-xs font-bold text-[#F9CD05] mb-5">
                This clears every sale in this room and can&apos;t be undone. Check STANDINGS first if you need the results.
              </p>
              <div className="flex items-center justify-end gap-3 font-condensed text-base font-black uppercase">
                <button
                  onClick={() => setShowRestartConfirm(false)}
                  className="px-4 py-2 border border-white/20 hover:bg-white/10 text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => run(() => restartRoom(roomId), () => setShowRestartConfirm(false))}
                  disabled={pending}
                  className="px-5 py-2 bg-[#F9CD05] text-black hover:bg-yellow-300 transition-colors cursor-pointer"
                >
                  Start New Auction
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Standings Modal ── */}
      <AnimatePresence>
        {showStandings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-white/20 bg-[#18181B] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <h3 className="font-condensed text-2xl font-black uppercase text-white">STANDINGS</h3>
                <button onClick={() => setShowStandings(false)} className="text-white/60 hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <StandingsTable teams={snapshot.teams} />
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
                <div className="flex items-center justify-between bg-white/5 p-2">
                  <span className="font-bold text-brand-yellow">[N] KEY</span>
                  <span>Next Player (after SOLD / UNSOLD)</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 p-2">
                  <span className="font-bold text-brand-yellow">[R] KEY</span>
                  <span>Replay Sold Animation (all screens)</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 p-2">
                  <span className="font-bold text-brand-yellow">[SPACE]</span>
                  <span>Pause / Resume Bidding</span>
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
      <SoldCelebration
        trigger={soldTrigger}
        showCard
        player={lot ? {
          name: lot.player.name,
          price: lot.currentBid,
          teamName: soldColor?.name,
          teamColor: soldColor?.colorAccent,
        } : undefined}
      />
    </div>
  )
}
