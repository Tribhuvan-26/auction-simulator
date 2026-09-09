'use client'

import { useState } from 'react'
import { BrutalCard } from '@/components/ui/brutal-card'
import { advanceToNextLot, type AdminSnapshot } from '@/app/admin/[roomId]/actions'

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

  async function handleLoadNext() {
    onSnapshot(await advanceToNextLot(roomId))
  }

  return (
    <BrutalCard className="w-64 flex flex-col gap-2">
      <h2 className="font-heading">Player Queue</h2>
      <input
        placeholder="Search players"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border-2 border-brand-charcoal px-2 py-1"
      />
      <label>
        Role
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border-2 border-brand-charcoal ml-2"
        >
          <option value="">All</option>
          <option value="BATTER">Batter</option>
          <option value="BOWLER">Bowler</option>
          <option value="ALL_ROUNDER">All-Rounder</option>
          <option value="WICKET_KEEPER">Wicket-Keeper</option>
        </select>
      </label>
      <button
        onClick={handleLoadNext}
        className="border-2 border-brand-charcoal px-3 py-1 bg-brand-blue text-brand-white"
      >
        Load Next
      </button>
      <ul className="flex flex-col gap-1 overflow-y-auto">
        {filtered.map((p) => (
          <li key={p.id} className="border-2 border-brand-charcoal px-2 py-1">
            {p.name} — {p.setNumber}
          </li>
        ))}
      </ul>
    </BrutalCard>
  )
}
