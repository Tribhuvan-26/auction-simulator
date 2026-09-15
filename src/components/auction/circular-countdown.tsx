'use client'

import React from 'react'
import { formatClock } from '@/lib/clock'

interface CircularCountdownProps {
  seconds: number | null
  totalSeconds?: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function CircularCountdown({
  seconds,
  totalSeconds = 90,
  size = 140,
  strokeWidth = 8,
  className = '',
}: CircularCountdownProps) {
  const currentSecs = seconds ?? 0
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(1, currentSecs / totalSeconds))
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="rotate-[-90deg] transform"
          aria-label={`Timer: ${formatClock(currentSecs)}`}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#222222"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Active arc in Brand Pink */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#EB547C"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Centered Digital Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-condensed text-3xl font-black tracking-wider text-white tabular-nums">
            {formatClock(currentSecs)}
          </span>
        </div>
      </div>
    </div>
  )
}
