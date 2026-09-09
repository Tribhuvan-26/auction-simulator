'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { BrutalCard } from '@/components/ui/brutal-card'
import { BrutalButton } from '@/components/ui/brutal-button'
import { Pause, Play, Octagon } from 'lucide-react'
import { useLiveSnapshot } from '@/hooks/use-live-snapshot'
import { useState } from 'react'
import {
  getAdminSnapshot,
  setPhase,
  markSold,
  markUnsold,
  undoLastBid,
  controlTimer,
  type AdminSnapshot,
} from './actions'
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
  const { snapshot, setSnapshot } = useLiveSnapshot(roomId, initialSnapshot, getAdminSnapshot)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!snapshot.currentLot) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
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
  }, [roomId, snapshot, setSnapshot])

  async function handlePauseResume() {
    setSnapshot(await setPhase(roomId, snapshot.room.phase === 'LIVE' ? 'PAUSED' : 'LIVE'))
  }

  async function handleEndAuction() {
    setSnapshot(await setPhase(roomId, 'COMPLETED'))
    setShowEndConfirm(false)
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-brand-charcoal p-4">
      <BrutalCard className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="font-heading text-xs font-bold underline">
            All rooms
          </Link>
          <h1 className="font-heading text-2xl font-bold leading-tight">{snapshot.room.name}</h1>
          <p className="text-xs">Admin console · round {snapshot.room.round}</p>
        </div>

        <span className="border-[3px] border-brand-charcoal bg-brand-yellow px-3 py-1 font-heading text-lg font-bold">
          {snapshot.room.phase}
        </span>

        <div className="flex gap-2">
          <BrutalButton variant="blue" onClick={handlePauseResume} className="flex items-center gap-2">
            {snapshot.room.phase === 'LIVE' ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {snapshot.room.phase === 'LIVE' ? 'Pause' : 'Resume'}
          </BrutalButton>
          <BrutalButton variant="dark" onClick={() => setShowEndConfirm(true)} className="flex items-center gap-2">
            <Octagon size={16} aria-hidden /> End auction
          </BrutalButton>
        </div>
      </BrutalCard>

      <AnimatePresence>
        {showEndConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-brand-charcoal/70 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              <BrutalCard className="max-w-sm">
                <h2 className="font-heading text-xl font-bold">Are you sure?</h2>
                <p className="mt-1">
                  Ending the auction closes the room for every team. Unsold players stay unsold.
                </p>
                <div className="mt-4 flex gap-2">
                  <BrutalButton variant="pink" onClick={handleEndAuction}>
                    End auction
                  </BrutalButton>
                  <BrutalButton onClick={() => setShowEndConfirm(false)}>Cancel</BrutalButton>
                </div>
              </BrutalCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 flex-wrap items-start gap-4">
        <PlayerQueue roomId={roomId} queue={snapshot.queue} onSnapshot={setSnapshot} />
        <LiveLotControl roomId={roomId} snapshot={snapshot} onSnapshot={setSnapshot} />
        <TeamPurseTable
          teams={snapshot.teams}
          activeBiddingTeamId={snapshot.currentLot?.currentBiddingTeamId ?? null}
        />
      </div>

      <BidLog bidHistory={snapshot.currentLot?.bidHistory ?? []} />
    </div>
  )
}
