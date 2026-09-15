'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IplLogo } from '@/components/ui/ipl-logo'
import { StatusBeacon } from '@/components/ui/architectural-primitives'
import { IstClock } from '@/components/ui/ist-clock'
import { Menu, X, Shield, Users, Tv, Home } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface GlobalHeaderProps {
  roomId?: string
  roomName?: string
  teamName?: string
  phase?: string
  round?: number
  className?: string
  activeTab?: 'auction' | 'teams' | 'players' | 'history' | 'admin' | string
  location?: string
  liveBeacon?: boolean
}

/**
 * Architectural Global Header & Navigation
 * Exact visual translation of the top broadcast bar from the reference images.
 */
export function GlobalHeader({
  roomId,
  roomName,
  teamName,
  phase = 'LIVE',
  round,
  className,
  activeTab,
  location = 'CHENNAI, INDIA',
  liveBeacon = true,
}: GlobalHeaderProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Determine current active navigation route
  const isHome = pathname === '/'
  const isDisplay = pathname.includes('/display')
  const isAdmin = pathname.includes('/admin')
  const isTeam = pathname.includes('/team')

  const navLinks = [
    {
      label: 'AUCTION',
      href: roomId ? `/display/${roomId}` : '/',
      active: isDisplay || (isHome && !isAdmin && !isTeam),
      icon: Tv,
    },
    {
      label: 'TEAMS',
      href: roomId && isTeam ? pathname : roomId ? `/team/${roomId}` : '/',
      active: isTeam,
      icon: Users,
    },
    {
      label: 'ADMIN',
      href: roomId ? `/admin/${roomId}` : '/',
      active: isAdmin,
      icon: Shield,
    },
    {
      label: 'ROOMS',
      href: '/',
      active: isHome,
      icon: Home,
    },
  ]

  return (
    <header
      className={cn(
        'relative z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-white/10 bg-black/30 px-4 backdrop-blur-md md:px-8',
        className
      )}
    >
      {/* Left: Brand Emblem + Wordmark */}
      <div className="flex items-center gap-6 md:gap-10">
        <Link
          href="/"
          className="group flex items-center transition-opacity hover:opacity-90"
          title="IPL Auction Live"
        >
          <IplLogo size="md" />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.label}
                href={link.href}
                className={cn(
                  'relative flex items-center gap-2 px-3.5 py-2 font-mono text-[11px] font-bold tracking-[0.16em] uppercase transition-colors',
                  link.active
                    ? 'text-white'
                    : 'text-white/55 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon size={14} className={link.active ? 'text-brand-blue' : 'text-white/40'} />
                <span>{link.label}</span>
                {link.active && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-brand-blue shadow-[0_0_8px_rgba(32,116,213,0.8)]" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Center: Active Context or Room Breadcrumb if present */}
      {(roomName || teamName) && (
        <div className="hidden lg:flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
          {roomName && <span>ROOM: <strong className="text-white font-heading text-xs">{roomName}</strong></span>}
          {round !== undefined && <span>• ROUND {round}</span>}
          {teamName && <span>• SEAT: <strong className="text-brand-yellow font-heading text-xs">{teamName}</strong></span>}
        </div>
      )}

      {/* Right: Telemetry Controls (Live beacon, IST clock, Location, Mobile toggle) */}
      <div className="flex items-center gap-4 md:gap-6">
        {/* Status Beacon */}
        <StatusBeacon label={phase} />

        {/* Real-time IST Digital Clock */}
        <div className="hidden sm:flex items-center font-mono text-[11px] font-bold tracking-widest text-white/80 tabular-nums">
          <IstClock />
        </div>

        {/* Location Metadata */}
        <div className="hidden xl:flex items-center border-l border-white/15 pl-4 font-mono text-[10px] tracking-[0.2em] text-white/45 uppercase">
          CHENNAI, INDIA
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex h-9 w-9 items-center justify-center border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-14 left-0 right-0 z-50 border-b border-white/15 bg-[#161616] p-4 shadow-2xl md:hidden">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center justify-between border border-white/10 px-4 py-3 font-mono text-xs font-bold tracking-widest uppercase',
                    link.active
                      ? 'border-brand-blue bg-brand-blue/15 text-white'
                      : 'bg-[#1C1C1C] text-white/70 hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} className={link.active ? 'text-brand-blue' : 'text-white/40'} />
                    <span>{link.label}</span>
                  </div>
                  {link.active && <span className="text-[10px] text-brand-blue font-mono">ACTIVE</span>}
                </Link>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[10px] text-white/50">
            <span>LOCATION: CHENNAI, INDIA</span>
            <IstClock />
          </div>
        </div>
      )}
    </header>
  )
}
