'use client'

import { BrutalCard } from '@/components/ui/brutal-card'
import { BrutalButton } from '@/components/ui/brutal-button'
import { BidNumber } from '@/components/ui/bid-number'
import { Play, Pause, RotateCcw, Plus, Check, X, Undo2 } from 'lucide-react'
import {
  placeBid,
  markSold,
  markUnsold,
  undoLastBid,
  controlTimer,
  type AdminSnapshot,
} from '@/app/admin/[roomId]/actions'

const INCREMENTS = [5, 10, 25, 50]

export function LiveLotControl({
  roomId,
  snapshot,
  onSnapshot,
}: {
  roomId: string
  snapshot: AdminSnapshot
  onSnapshot: (s: AdminSnapshot) => void
}) {
  const lot = snapshot.currentLot

  if (!lot) {
    return (
      <BrutalCard className="flex-1">
        <h2 className="font-heading text-2xl font-bold">No lot on the block</h2>
        <p className="mt-2">Load the next player from the queue to start bidding.</p>
      </BrutalCard>
    )
  }

  const closed = lot.status === 'SOLD' || lot.status === 'UNSOLD'
  // Quick-increment bids go to the first team that isn't already the top bidder —
  // in a real room the auctioneer calls the team out loud.
  // ponytail: no team picker; add one if bids need explicit attribution.
  const nextBidder = snapshot.teams.find((t) => t.id !== lot.currentBiddingTeamId) ?? snapshot.teams[0]
  const leader = snapshot.teams.find((t) => t.id === lot.currentBiddingTeamId)

  async function handleIncrement(amount: number) {
    if (!nextBidder) return
    onSnapshot(await placeBid(roomId, nextBidder.id, lot!.currentBid + amount))
  }

  async function handleTimer(action: 'start' | 'pause' | 'reset' | 'add10') {
    onSnapshot(await controlTimer(roomId, action))
  }

  return (
    <BrutalCard
      variant={lot.status === 'SOLD' ? 'sold' : lot.status === 'UNSOLD' ? 'unsold' : 'active'}
      className="flex-1 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-xs font-bold">{lot.player.setNumber}</p>
          <h2 className="font-heading text-4xl font-bold leading-tight">{lot.player.name}</h2>
          <p className="mt-1 text-sm">
            {lot.player.role.replace('_', '-')} · {lot.player.nationality}
            {lot.player.isOverseas ? ' · overseas' : ''} · {lot.player.matches} matches
          </p>
        </div>
        <span className="shrink-0 border-[3px] border-brand-charcoal bg-brand-yellow px-2 py-1 font-heading text-sm font-bold">
          Base {lot.player.basePrice}
        </span>
      </div>

      <div className="border-[3px] border-brand-charcoal p-4">
        <BidNumber value={lot.currentBid} className="anim-bid-pop block text-6xl" />
        <p className="text-sm">
          {closed
            ? `${lot.status} — advance to the next lot`
            : leader
              ? `Leading: ${leader.name}`
              : 'No bids yet'}
        </p>
      </div>

      <div>
        <p className="mb-2 font-heading text-xs font-bold">Raise the bid</p>
        <div className="flex flex-wrap gap-2">
          {INCREMENTS.map((inc) => (
            <BrutalButton
              key={inc}
              variant="yellow"
              onClick={() => handleIncrement(inc)}
              disabled={closed || !nextBidder}
            >
              +{inc}L
            </BrutalButton>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-heading text-xs font-bold">Timer · {lot.timerSeconds}s</p>
        <div className="flex flex-wrap items-center gap-2">
          <BrutalButton onClick={() => handleTimer('start')} className="flex items-center gap-1">
            <Play size={16} aria-hidden /> Start
          </BrutalButton>
          <BrutalButton onClick={() => handleTimer('pause')} className="flex items-center gap-1">
            <Pause size={16} aria-hidden /> Pause
          </BrutalButton>
          <BrutalButton onClick={() => handleTimer('reset')} className="flex items-center gap-1">
            <RotateCcw size={16} aria-hidden /> Reset
          </BrutalButton>
          <BrutalButton onClick={() => handleTimer('add10')} className="flex items-center gap-1">
            <Plus size={16} aria-hidden /> 10s
          </BrutalButton>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t-[3px] border-brand-charcoal pt-4">
        <BrutalButton
          variant="blue"
          onClick={async () => onSnapshot(await markSold(roomId))}
          disabled={!lot.currentBiddingTeamId || closed}
          className="flex items-center gap-2 text-lg"
        >
          <Check size={20} aria-hidden /> SOLD
        </BrutalButton>
        <BrutalButton
          onClick={async () => onSnapshot(await markUnsold(roomId))}
          disabled={closed}
          className="flex items-center gap-2 text-lg"
        >
          <X size={20} aria-hidden /> UNSOLD
        </BrutalButton>
        <BrutalButton
          variant="pink"
          onClick={async () => onSnapshot(await undoLastBid(roomId))}
          className="flex items-center gap-2 text-lg"
        >
          <Undo2 size={20} aria-hidden /> UNDO
        </BrutalButton>
        <span className="self-center text-xs">Keys: S sold · U unsold · Z undo · Space timer</span>
      </div>
    </BrutalCard>
  )
}
