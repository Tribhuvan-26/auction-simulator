'use client'

import React from 'react'
import { formatMoney } from '@/lib/money'

interface PurseBreakdownDonutProps {
  purseTotal: number
  purseRemaining: number
  className?: string
}

export function PurseBreakdownDonut({
  purseTotal,
  purseRemaining,
  className = '',
}: PurseBreakdownDonutProps) {
  const spent = Math.max(0, purseTotal - purseRemaining)
  const spentPercent = purseTotal > 0 ? (spent / purseTotal) : 0.75

  const size = 160
  const strokeWidth = 22
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const spentOffset = circumference * (1 - spentPercent)

  return (
    <div className={`flex flex-col border border-white/10 bg-[#1A1A1A] p-4 text-white ${className}`}>
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-3 border-b border-white/10 pb-2">
        PURSE BREAKDOWN
      </span>

      <div className="flex items-center justify-around gap-4 py-2">
        {/* Donut Chart */}
        <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="rotate-[-90deg] transform">
            {/* Background ring (Remaining - Grey) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#3F3F46"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Spent Arc (Blue) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#2074D5"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={spentOffset}
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Centered Total Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-condensed text-xl font-black text-white leading-none">
              {formatMoney(purseTotal)}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/60 mt-1">
              TOTAL
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-[#2074D5] shrink-0" />
            <div className="flex flex-col">
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/50">
                SPENT
              </span>
              <span className="font-condensed text-xl font-black text-white tabular-nums">
                {formatMoney(spent)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-[#3F3F46] shrink-0" />
            <div className="flex flex-col">
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/50">
                REMAINING
              </span>
              <span className="font-condensed text-xl font-black text-white tabular-nums">
                {formatMoney(purseRemaining)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
