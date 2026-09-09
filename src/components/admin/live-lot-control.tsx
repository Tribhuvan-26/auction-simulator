'use client'

import { useState } from 'react'
import { formatMoney } from '@/lib/money'
import { getNextBidAmount } from '@/lib/bid-rules'
import { BrutalCard } from '@/components/ui/brutal-card'
import { BrutalButton } from '@/components/ui/brutal-button'
import { BidNumber } from '@/components/ui/bid-number'
import { PlayerAvatar } from '@/components/ui/player-avatar'
import { Play, Pause, RotateCcw, Plus, Check, X, Undo2 } from 'lucide-react'
import {
  placeBid,
  markSold,
  markUnsold,
  undoLastBid,
  controlTimer,
  type AdminSnapshot,
} from '@/app/admin/[roomId]/actions'

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

  // Explicit team picker — the operator calls out the team taking the raise,
  // so quick-increment bids get attributed to whichever team is selected here
  // rather than a guessed "next" team. Defaults to whoever isn't currently
  // leading, but the operator can change it before hitting an increment.
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(
    snapshot.teams.find((t) => t.id !== lot?.currentBiddingTeamId)?.id ?? snapshot.teams[0]?.id
  )
  const [error, setError] = useState<string | null>(null)

  if (!lot) {
    return (
      <BrutalCard className="flex-1">
        <h2 className="font-heading text-2xl font-bold">No lot on the block</h2>
        <p className="mt-2">Load the next player from the queue to start bidding.</p>
      </BrutalCard>
    )
  }

  const closed = lot.status === 'SOLD' || lot.status === 'UNSOLD'
  const leader = snapshot.teams.find((t) => t.id === lot.currentBiddingTeamId)
  const selectedTeam = snapshot.teams.find((t) => t.id === selectedTeamId)
  // The ladder allows one amount — the server rejects anything else.
  const nextBid =
    lot.status === 'BIDDING' ? getNextBidAmount(lot.currentBid, lot.player.basePrice) : lot.currentBid

  async function handleRaise() {
    if (!selectedTeamId) return
    setError(null)
    try {
      onSnapshot(await placeBid(roomId, selectedTeamId, nextBid))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bid rejected')
    }
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
        <div className="flex items-start gap-3">
          <PlayerAvatar name={lot.player.name} photoUrl={lot.player.photoUrl} className="h-14 w-14 text-sm" />
          <div>
            <p className="font-heading text-xs font-bold">{lot.player.setNumber}</p>
            <h2 className="font-heading text-4xl font-bold leading-tight">{lot.player.name}</h2>
            <p className="mt-1 text-sm">
              {lot.player.role.replace('_', '-')} · {lot.player.nationality}
              {lot.player.isOverseas ? ' · overseas' : ''}
              {lot.player.matches > 0 ? ` · ${lot.player.matches} matches` : ''}
            </p>
          </div>
        </div>
        <span className="shrink-0 border-[3px] border-brand-charcoal bg-brand-yellow px-2 py-1 font-heading text-sm font-bold">
          Base {formatMoney(lot.player.basePrice)}
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
        <p className="mb-2 font-heading text-xs font-bold">Bidding team</p>
        <select
          className="w-full border-[3px] border-brand-charcoal bg-white px-2 py-2 font-heading text-sm font-bold"
          value={selectedTeamId ?? ''}
          onChange={(e) => setSelectedTeamId(e.target.value || undefined)}
          disabled={closed}
        >
          {snapshot.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.id === lot.currentBiddingTeamId ? ' (currently leading)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-2 font-heading text-xs font-bold">
          Raise the bid{selectedTeam ? ` for ${selectedTeam.name}` : ''}
        </p>
        <BrutalButton
          variant="yellow"
          onClick={handleRaise}
          disabled={closed || !selectedTeamId}
          className="w-full"
        >
          Raise to {formatMoney(nextBid)}
        </BrutalButton>
        {error && <p className="mt-2 text-sm font-bold text-brand-pink">{error}</p>}
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
