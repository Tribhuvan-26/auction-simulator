'use client'

import React from 'react'
import { formatMoney } from '@/lib/money'

export interface SquadPlayerItem {
  id: string
  name: string
  role: string
  price: number
  photoUrl?: string | null
  isOverseas?: boolean
}

interface CurrentSquadTableProps {
  squad: SquadPlayerItem[]
  squadMax?: number
  className?: string
}

export function CurrentSquadTable({
  squad,
  squadMax = 25,
  className = '',
}: CurrentSquadTableProps) {
  // Format role code to match Reference 3 (BAT, AR, BOWL, WK)
  const formatRole = (role: string) => {
    const r = role.toUpperCase()
    if (r.includes('WICKET') || r === 'WK') return 'WK'
    if (r.includes('ALL') || r === 'ALL_ROUNDER' || r === 'AR') return 'AR'
    if (r.includes('BOWL') || r === 'BOWLER') return 'BOWL'
    return 'BAT'
  }

  // Create array of max slots
  const slots = Array.from({ length: squadMax }, (_, i) => ({
    slotNumber: i + 1,
    player: squad[i] || null,
  }))

  return (
    <div className={`flex flex-col border border-white/10 bg-[#1A1A1A] p-4 text-white ${className}`}>
      <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
          CURRENT SQUAD
        </span>
        <span className="font-mono text-[10px] text-white/50">
          {squad.length} / {squadMax} SIGNED
        </span>
      </div>

      <div className="flex flex-col overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[36px_1fr_60px_100px] border-b border-white/10 pb-2 font-mono text-[9px] font-bold uppercase tracking-widest text-white/40">
          <div>#</div>
          <div>PLAYER</div>
          <div>ROLE</div>
          <div className="text-right">PRICE</div>
        </div>

        {/* Rows */}
        <div className="scrollbar-thin-dark flex flex-col divide-y divide-white/5 overflow-y-auto max-h-[360px] pr-1">
          {slots.map(({ slotNumber, player }) => {
            if (player) {
              return (
                <div
                  key={player.id}
                  className="grid grid-cols-[36px_1fr_60px_100px] items-center py-2.5 text-xs hover:bg-white/[0.02] transition-colors"
                >
                  <div className="font-mono text-white/40">{slotNumber}</div>
                  <div className="flex items-center gap-1.5 font-bold text-white truncate">
                    <span>{player.name}</span>
                    {player.isOverseas && (
                      <span className="text-[9px] font-mono text-brand-blue uppercase">
                        [OS]
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] font-semibold text-white/70">
                    {formatRole(player.role)}
                  </div>
                  <div className="font-condensed text-right font-black text-white tabular-nums">
                    {formatMoney(player.price)}
                  </div>
                </div>
              )
            }

            return (
              <div
                key={`slot-${slotNumber}`}
                className="grid grid-cols-[36px_1fr_60px_100px] items-center py-2 text-xs text-white/30 hover:bg-white/[0.01]"
              >
                <div className="font-mono text-white/20">{slotNumber}</div>
                <div className="font-mono text-[11px] tracking-wider text-white/40">
                  Slot {slotNumber}
                </div>
                <div className="font-mono text-white/20">—</div>
                <div className="font-mono text-right text-white/20">—</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
