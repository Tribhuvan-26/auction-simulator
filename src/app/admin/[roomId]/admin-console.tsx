'use client'

import { useEffect, useState } from 'react'
import { BrutalCard } from '@/components/ui/brutal-card'
import { useAuctionSocket } from '@/hooks/use-auction-socket'
import { useAuctionStore } from '@/stores/auction-store'
import { setPhase, markSold, markUnsold, undoLastBid, controlTimer, type AdminSnapshot } from './actions'
import { PlayerQueue } from '@/components/admin/player-queue'
import { LiveLotControl } from '@/components/admin/live-lot-control'
import { TeamPurseTable } from '@/components/admin/team-purse-table'
import { BidLog } from '@/components/admin/bid-log'

export function AdminConsole({
  roomId,
  initialSnapshot,
}: {
  roomId: string
  initialSnapshot: AdminSnapshot
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  useAuctionSocket(roomId)

  useEffect(() => {
    useAuctionStore.getState().setRoom({
      id: snapshot.room.id,
      phase: snapshot.room.phase,
      currentLot: snapshot.currentLot
        ? {
            id: snapshot.currentLot.id,
            playerId: snapshot.currentLot.player.id,
            currentBid: snapshot.currentLot.currentBid,
            currentBiddingTeamId: snapshot.currentLot.currentBiddingTeamId,
            status: snapshot.currentLot.status,
            bidHistory: snapshot.currentLot.bidHistory,
          }
        : null,
      teams: snapshot.teams.map((t) => ({ id: t.id, name: t.name, purseRemaining: t.purseRemaining })),
    })
  }, [snapshot])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!snapshot.currentLot) return
      if (e.key === ' ') {
        e.preventDefault()
        controlTimer(roomId, snapshot.room.phase === 'PAUSED' ? 'start' : 'pause').then(setSnapshot)
      } else if (e.key.toLowerCase() === 's') {
        markSold(roomId).then(setSnapshot)
      } else if (e.key.toLowerCase() === 'u') {
        markUnsold(roomId).then(setSnapshot)
      } else if (e.key.toLowerCase() === 'z') {
        undoLastBid(roomId).then(setSnapshot)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [roomId, snapshot])

  async function handlePauseResume() {
    const next = snapshot.room.phase === 'LIVE' ? 'PAUSED' : 'LIVE'
    setSnapshot(await setPhase(roomId, next))
  }

  async function handleEndAuction() {
    setSnapshot(await setPhase(roomId, 'COMPLETED'))
    setShowEndConfirm(false)
  }

  return (
    <div className="min-h-screen bg-brand-charcoal p-4 flex flex-col gap-4">
      <BrutalCard className="flex items-center justify-between">
        <span className="font-heading text-xl">Auction Live — Admin</span>
        <span className="bg-brand-yellow border-2 border-brand-charcoal px-3 py-1 font-heading">
          {snapshot.room.phase}
        </span>
        <div className="flex gap-2">
          <button onClick={handlePauseResume} className="border-2 border-brand-charcoal px-3 py-1 bg-brand-blue text-brand-white">
            {snapshot.room.phase === 'LIVE' ? 'Pause' : 'Resume'}
          </button>
          <button onClick={() => setShowEndConfirm(true)} className="border-2 border-brand-charcoal px-3 py-1 bg-brand-charcoal text-brand-white">
            End Auction
          </button>
        </div>
      </BrutalCard>

      {showEndConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
          <BrutalCard>
            <p>Are you sure you want to end the auction?</p>
            <div className="flex gap-2 mt-2">
              <button onClick={handleEndAuction} className="border-2 border-brand-charcoal px-3 py-1 bg-brand-pink">Confirm</button>
              <button onClick={() => setShowEndConfirm(false)} className="border-2 border-brand-charcoal px-3 py-1">Cancel</button>
            </div>
          </BrutalCard>
        </div>
      )}

      <div className="flex gap-4 flex-1">
        <PlayerQueue roomId={roomId} queue={snapshot.queue} onSnapshot={setSnapshot} />
        <LiveLotControl roomId={roomId} snapshot={snapshot} onSnapshot={setSnapshot} />
        <TeamPurseTable teams={snapshot.teams} activeBiddingTeamId={snapshot.currentLot?.currentBiddingTeamId ?? null} />
      </div>
      <BidLog bidHistory={snapshot.currentLot?.bidHistory ?? []} />
    </div>
  )
}
