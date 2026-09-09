'use client'

import { formatMoney } from '@/lib/money'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BrutalCard } from '@/components/ui/brutal-card'
import { BrutalButton } from '@/components/ui/brutal-button'
import { bidRejectionReason } from '@/lib/bid-rules'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { getAdminSnapshot, placeBid, type AdminSnapshot } from '@/app/admin/[roomId]/actions'
import { BidNumber } from '@/components/ui/bid-number'
import { PlayerAvatar } from '@/components/ui/player-avatar'
import { Gavel, TriangleAlert } from 'lucide-react'

const BID_STEP = 5

export function TeamConsole({
  roomId,
  teamId,
  initialSnapshot,
}: {
  roomId: string
  teamId: string
  initialSnapshot: AdminSnapshot
}) {
  const [toastState, setToastState] = useState<{ text: string; tone: 'blue' | 'pink' } | null>(null)
  const leaderRef = useRef(initialSnapshot.currentLot?.currentBiddingTeamId ?? null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { snapshot, setSnapshot } = useLiveSnapshot(
    roomId,
    initialSnapshot,
    getAdminSnapshot,
    (event) => {
      if (event.type !== 'BID') return
      const weLead = event.teamId === teamId
      if (!weLead && leaderRef.current !== teamId) return
      setToastState(
        weLead
          ? { text: 'You are the highest bidder', tone: 'blue' }
          : { text: 'Outbid — raise again to take it back', tone: 'pink' }
      )
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToastState(null), 3200)
    }
  )

  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const toast = toastState

  const team = snapshot.teams.find((t) => t.id === teamId)!
  const lot = snapshot.currentLot
  const nextBid = lot ? lot.currentBid + (lot.status === 'BIDDING' ? BID_STEP : 0) : 0
  const leading = lot?.currentBiddingTeamId === teamId

  // Who holds the lot, tracked in a ref so the socket callback can tell an
  // "outbid" event (we were leading) from a bid we were never in.
  useEffect(() => {
    leaderRef.current = lot?.currentBiddingTeamId ?? null
  }, [lot?.currentBiddingTeamId])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const rejection = lot ? bidRejectionReason(team, lot, nextBid) : 'Waiting for the next player'
  const pursePercent = Math.max(0, Math.round((team.purseRemaining / team.purseTotal) * 100))

  async function handleBid() {
    setPending(true)
    setError(null)
    try {
      setSnapshot(await placeBid(roomId, teamId, nextBid))
    } catch {
      setError('Bid rejected — someone got there first')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex-1 bg-brand-white pb-40">
      <header
        className="border-b-[3px] border-brand-charcoal px-5 py-4 text-brand-white"
        style={{ backgroundColor: team.colorAccent }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-heading text-2xl font-bold leading-tight">{team.name}</h1>
          <span className="border-[3px] border-brand-white px-2 py-1 font-heading text-sm font-bold">
            {team.shortCode}
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-heading text-4xl font-bold tabular-nums">{formatMoney(team.purseRemaining)}</span>
          <span className="text-sm opacity-90">of {formatMoney(team.purseTotal)} left</span>
        </div>
        <div className="mt-2 h-4 rounded-full border-[3px] border-brand-charcoal bg-brand-white">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-500 ${
              pursePercent <= 15 ? 'bg-brand-pink' : pursePercent <= 40 ? 'bg-brand-yellow' : 'bg-brand-blue'
            }`}
            style={{ width: `${pursePercent}%` }}
          />
        </div>
        <p className="mt-2 text-sm opacity-90">
          Squad {team.squadCount}/{team.squadMax} · Overseas {team.overseasSlotsUsed}/{team.overseasSlotsMax}
        </p>
      </header>

      <div className="mx-auto max-w-xl px-5 py-6">
        <AnimatePresence mode="wait">
          {lot ? (
            <motion.div
              key={lot.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <BrutalCard variant={leading ? 'active' : 'default'} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <PlayerAvatar name={lot.player.name} photoUrl={lot.player.photoUrl} className="h-12 w-12 text-xs" />
                    <div>
                      <h2 className="font-heading text-3xl font-bold leading-tight">{lot.player.name}</h2>
                      <p className="mt-1 text-sm">
                        {lot.player.role.replace('_', '-')} · {lot.player.nationality}
                        {lot.player.isOverseas ? ' · overseas' : ''} · {lot.player.matches} matches
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 border-[3px] border-brand-charcoal bg-brand-yellow px-2 py-1 font-heading text-sm font-bold">
                    Base {formatMoney(lot.player.basePrice)}
                  </span>
                </div>

                <div className="mt-3 rounded-xl border-[3px] border-brand-charcoal p-3">
                  <p className="font-heading text-xs font-bold">Current bid</p>
                  <BidNumber value={lot.currentBid} className="block text-6xl" />
                  <p className="text-sm">
                    {lot.currentBiddingTeamId
                      ? leading
                        ? 'Yours — you hold the lot'
                        : `Held by ${snapshot.teams.find((t) => t.id === lot.currentBiddingTeamId)?.name}`
                      : 'No bids yet'}
                  </p>
                </div>
              </BrutalCard>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BrutalCard>
                <h2 className="font-heading text-xl font-bold">Between lots</h2>
                <p className="mt-1">The auctioneer is loading the next player. Sit tight.</p>
              </BrutalCard>
            </motion.div>
          )}
        </AnimatePresence>

        <h3 className="mt-8 font-heading text-lg font-bold">Your squad</h3>
        {team.squad.length === 0 ? (
          <p className="mt-1 text-sm">Nothing bought yet. Your first buy shows up here.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {team.squad.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-xl border-[3px] border-brand-charcoal px-2 py-1 text-sm"
              >
                <span className="font-heading font-bold">{p.name}</span>
                <span className="tabular-nums">{p.price}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-x-4 bottom-32 z-20 border-[3px] border-brand-charcoal px-4 py-3 font-heading font-bold text-brand-white shadow-brutal ${
              toast.tone === 'blue' ? 'bg-brand-blue' : 'bg-brand-pink'
            }`}
            role="status"
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-x-0 bottom-0 border-t-[3px] border-brand-charcoal bg-brand-white p-4">
        <BrutalButton
          variant={leading ? 'yellow' : 'pink'}
          onClick={handleBid}
          disabled={!!rejection || pending || leading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-6 text-3xl"
        >
          <Gavel size={28} aria-hidden />
          {leading ? 'You hold this lot' : `Bid ${formatMoney(nextBid)}`}
        </BrutalButton>
        <p
          className={`mt-2 flex items-center justify-center gap-1 text-center text-sm ${
            !leading && (!!rejection || !!error) ? 'font-bold text-brand-pink' : ''
          }`}
        >
          {!leading && (!!rejection || !!error) && <TriangleAlert size={14} aria-hidden />}
          {error ?? (leading ? 'Wait for another team to raise' : (rejection ?? `Raises the bid by ${formatMoney(BID_STEP)}`))}
        </p>
      </div>
    </main>
  )
}
