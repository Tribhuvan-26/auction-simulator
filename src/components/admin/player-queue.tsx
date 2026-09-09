'use client'

import { formatMoney } from '@/lib/money'
import { useState } from 'react'
import { BrutalCard } from '@/components/ui/brutal-card'
import { BrutalButton } from '@/components/ui/brutal-button'
import { PlayerAvatar } from '@/components/ui/player-avatar'
import { advanceToNextLot, type AdminSnapshot } from '@/app/admin/[roomId]/actions'
import { Search, ArrowRight } from 'lucide-react'

export function PlayerQueue({
  roomId,
  queue,
  onSnapshot,
}: {
  roomId: string
  queue: AdminSnapshot['queue']
  onSnapshot: (s: AdminSnapshot) => void
}) {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')

  const filtered = queue.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) && (role === '' || p.role === role)
  )

  return (
    <BrutalCard className="layer-plate layer-plate-blue flex w-72 shrink-0 flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-xl font-bold">Queue</h2>
        <span className="font-heading text-sm tabular-nums">{queue.length} left</span>
      </div>

      <BrutalButton
        variant="blue"
        onClick={async () => onSnapshot(await advanceToNextLot(roomId))}
        className="flex items-center justify-center gap-2"
      >
        Load next player <ArrowRight size={16} aria-hidden />
      </BrutalButton>

      <div className="relative">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" />
        <input
          placeholder="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border-[3px] border-brand-charcoal py-1 pl-8 pr-2"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        Role
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="flex-1 border-[3px] border-brand-charcoal px-1 py-1"
        >
          <option value="">All</option>
          <option value="BATTER">Batter</option>
          <option value="BOWLER">Bowler</option>
          <option value="ALL_ROUNDER">All-Rounder</option>
          <option value="WICKET_KEEPER">Wicket-Keeper</option>
        </select>
      </label>

      {filtered.length === 0 ? (
        <p className="text-sm">Nothing matches that filter.</p>
      ) : (
        <ul className="flex max-h-[52vh] flex-col gap-1 overflow-y-auto">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border-[3px] border-brand-charcoal px-2 py-1"
            >
              <span className="flex min-w-0 items-center gap-2">
                <PlayerAvatar name={p.name} photoUrl={p.photoUrl} className="h-8 w-8 text-[10px]" />
                <span className="truncate">
                  <span className="font-heading font-bold">{p.name}</span>
                  <span className="block text-xs">{p.setNumber}</span>
                </span>
              </span>
              <span className="shrink-0 font-heading text-sm tabular-nums">{formatMoney(p.basePrice)}</span>
            </li>
          ))}
        </ul>
      )}
    </BrutalCard>
  )
}
