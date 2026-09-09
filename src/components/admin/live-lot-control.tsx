'use client'

import { BrutalCard } from '@/components/ui/brutal-card'
import { placeBid, markSold, markUnsold, undoLastBid, controlTimer, type AdminSnapshot } from '@/app/admin/[roomId]/actions'

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
  if (!lot) return <BrutalCard className="flex-1">No active lot — load a player from the queue.</BrutalCard>

  // Quick-increment bids are attributed to the first team that isn't already the
  // current bidder — a real room calls the bidding team out verbally.
  // ponytail: no team-picker UI; add one if bids need explicit attribution.
  const nextBidder = snapshot.teams.find((t) => t.id !== lot.currentBiddingTeamId) ?? snapshot.teams[0]

  async function handleIncrement(amount: number) {
    if (!nextBidder) return
    onSnapshot(await placeBid(roomId, nextBidder.id, lot!.currentBid + amount))
  }

  async function handleSold() {
    onSnapshot(await markSold(roomId))
  }
  async function handleUnsold() {
    onSnapshot(await markUnsold(roomId))
  }
  async function handleUndo() {
    onSnapshot(await undoLastBid(roomId))
  }
  async function handleTimer(action: 'start' | 'pause' | 'reset' | 'add10') {
    onSnapshot(await controlTimer(roomId, action))
  }

  return (
    <BrutalCard className="flex-1 flex flex-col gap-2">
      <h2 className="font-heading">{lot.player.name}</h2>
      <p>
        {lot.player.role} — Base {lot.player.basePrice}
      </p>
      <p className="font-heading text-3xl tabular-nums">{lot.currentBid}</p>

      <div className="flex gap-2">
        {INCREMENTS.map((inc) => (
          <button key={inc} onClick={() => handleIncrement(inc)} className="border-2 border-brand-charcoal px-2 py-1 bg-brand-yellow">
            +{inc}L
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <button onClick={() => handleTimer('start')} className="border-2 border-brand-charcoal px-2 py-1">Start</button>
        <button onClick={() => handleTimer('pause')} className="border-2 border-brand-charcoal px-2 py-1">Pause</button>
        <button onClick={() => handleTimer('reset')} className="border-2 border-brand-charcoal px-2 py-1">Reset</button>
        <button onClick={() => handleTimer('add10')} className="border-2 border-brand-charcoal px-2 py-1">+10s</button>
        <span className="tabular-nums">{lot.timerSeconds}s</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSold}
          disabled={!lot.currentBiddingTeamId}
          className="border-2 border-brand-charcoal px-3 py-1 bg-brand-blue text-brand-white disabled:opacity-40"
        >
          SOLD
        </button>
        <button onClick={handleUnsold} className="border-2 border-brand-charcoal px-3 py-1">UNSOLD</button>
        <button onClick={handleUndo} className="border-2 border-brand-charcoal px-3 py-1 bg-brand-pink">UNDO</button>
      </div>
    </BrutalCard>
  )
}
