'use client'

import React from 'react'
import Link from 'next/link'
import { IplLogo } from '@/components/ui/ipl-logo'
import { StatusBeacon } from '@/components/ui/architectural-primitives'
import { IstClock } from '@/components/ui/ist-clock'
import { cn } from '@/lib/cn'

export interface GlobalHeaderProps {
  roomName?: string
  teamName?: string
  phase?: string
  className?: string
}

/**
 * Top broadcast bar for the projector: brand, room, live phase and IST clock.
 * No navigation — nobody clicks around on the big screen.
 */
export function GlobalHeader({ roomName, teamName, phase = 'LIVE', className }: GlobalHeaderProps) {
  return (
    <header
      className={cn(
        'relative z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-white/10 bg-black/30 px-4 backdrop-blur-md md:px-8',
        className
      )}
    >
      {/* Left: Brand Emblem + Wordmark */}
      <Link href="/" className="group flex items-center transition-opacity hover:opacity-90" title="IPL Auction Live">
        <IplLogo size="md" />
      </Link>

      {/* Center: Room Breadcrumb if present */}
      {(roomName || teamName) && (
        <div className="hidden lg:flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
          {roomName && <span>ROOM: <strong className="text-white font-heading text-xs">{roomName}</strong></span>}
          {teamName && <span>• SEAT: <strong className="text-brand-yellow font-heading text-xs">{teamName}</strong></span>}
        </div>
      )}

      {/* Right: Phase beacon and IST clock */}
      <div className="flex items-center gap-4 md:gap-6">
        <StatusBeacon label={phase} />
        <div className="hidden sm:flex items-center font-mono text-[11px] font-bold tracking-widest text-white/80 tabular-nums">
          <IstClock />
        </div>
      </div>
    </header>
  )
}
