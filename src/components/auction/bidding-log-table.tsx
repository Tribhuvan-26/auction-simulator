'use client'

import React from 'react'
import { formatMoney } from '@/lib/money'

export interface BiddingLogRow {
  key: string
  teamCode: string
  teamName?: string
  amount: number
  timestamp?: string | number | Date
  accentColor?: string
}

interface BiddingLogTableProps {
  title?: string
  rows: BiddingLogRow[]
  className?: string
  maxRows?: number
}

export function BiddingLogTable({
  title = 'BIDDING LOG',
  rows,
  className = '',
  maxRows = 8,
}: BiddingLogTableProps) {
  const displayRows = rows.slice(0, maxRows)

  const getTeamAccent = (code: string, customColor?: string) => {
    if (customColor) return customColor
    const accents: Record<string, string> = {
      MI: '#2074D5',
      CSK: '#F9D47B',
      RCB: '#EB547C',
      KKR: '#6A2D91',
      DC: '#2074D5',
      GT: '#1B2133',
      LSG: '#A5D6A7',
      PBKS: '#EB547C',
      RR: '#EB547C',
      SRH: '#F97316',
    }
    return accents[code.toUpperCase()] || '#2074D5'
  }

  const formatTime = (ts?: string | number | Date) => {
    if (!ts) return '18:42:15'
    try {
      const d = new Date(ts)
      if (isNaN(d.getTime())) return '18:42:15'
      return d.toLocaleTimeString('en-GB', { hour12: false })
    } catch {
      return '18:42:15'
    }
  }

  return (
    <div className={`flex flex-col border border-white/10 bg-[#1A1A1A] p-3 text-white ${className}`}>
      <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
          {title}
        </span>
      </div>

      <div className="flex flex-col overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[36px_1fr_1fr_1fr] border-b border-white/10 pb-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-white/40">
          <div>#</div>
          <div>TEAM</div>
          <div className="text-right">AMOUNT</div>
          <div className="text-right">TIME</div>
        </div>

        {/* Table Rows */}
        <div className="scrollbar-thin-dark flex flex-col divide-y divide-white/5 overflow-y-auto max-h-56">
          {displayRows.map((row, index) => {
            const rowNumber = rows.length - index
            const accent = getTeamAccent(row.teamCode, row.accentColor)

            return (
              <div
                key={row.key}
                className="grid grid-cols-[36px_1fr_1fr_1fr] items-center py-2 text-xs font-medium hover:bg-white/[0.02] transition-colors"
              >
                <div className="font-mono text-[11px] text-white/40">{rowNumber}</div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-1 shrink-0"
                    style={{ backgroundColor: accent }}
                  />
                  <span className="font-condensed font-bold tracking-wider text-white">
                    {row.teamCode}
                  </span>
                </div>
                <div className="font-condensed text-right font-black text-white tabular-nums">
                  {formatMoney(row.amount)}
                </div>
                <div className="font-mono text-right text-[10px] text-white/50 tabular-nums">
                  {formatTime(row.timestamp)}
                </div>
              </div>
            )
          })}

          {displayRows.length === 0 && (
            <div className="py-8 text-center font-mono text-xs uppercase tracking-widest text-white/30">
              Awaiting Opening Bid
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
