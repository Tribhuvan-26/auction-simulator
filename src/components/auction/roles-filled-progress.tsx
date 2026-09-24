'use client'

import React from 'react'

interface RoleCount {
  filled: number
  target: number
}

interface RolesFilledProgressProps {
  batsmen?: RoleCount
  allRounders?: RoleCount
  bowlers?: RoleCount
  wicketkeepers?: RoleCount
  className?: string
}

export function RolesFilledProgress({
  batsmen = { filled: 2, target: 6 },
  allRounders = { filled: 1, target: 4 },
  bowlers = { filled: 2, target: 5 },
  wicketkeepers = { filled: 0, target: 2 },
  className = '',
}: RolesFilledProgressProps) {
  const roles = [
    { label: 'BATSMEN', count: batsmen, color: '#2074D5' },
    { label: 'ALL-ROUNDERS', count: allRounders, color: '#F9D47B' },
    { label: 'BOWLERS', count: bowlers, color: '#EB547C' },
    { label: 'WICKETKEEPERS', count: wicketkeepers, color: '#EB547C' },
  ]

  return (
    <div className={`flex flex-col border border-white/10 bg-[#1A1A1A] p-4 text-white ${className}`}>
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-3 border-b border-white/10 pb-2">
        ROLES FILLED
      </span>

      <div className="flex flex-col gap-3 py-1">
        {roles.map((r) => {
          const percent = r.count.target > 0 ? Math.min(100, (r.count.filled / r.count.target) * 100) : 0
          return (
            <div key={r.label} className="flex items-center gap-3">
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-white/70 w-28 shrink-0">
                {r.label}
              </span>

              {/* Progress bar container */}
              <div className="relative h-4 flex-1 bg-[#262626] overflow-hidden">
                <div
                  className="h-full transition-all duration-500 rounded-none"
                  style={{
                    width: `${percent > 0 ? percent : 2}%`,
                    backgroundColor: r.color,
                  }}
                />
              </div>

              {/* Fraction label */}
              <span className="font-condensed text-xs font-black text-white/80 tabular-nums w-10 text-right">
                {r.count.filled} / {r.count.target}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
