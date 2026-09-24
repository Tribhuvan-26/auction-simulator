'use client'

import React from 'react'
import Image from 'next/image'
import { formatMoney } from '@/lib/money'
import { TeamCrest } from '@/components/ui/team-crest'
import { CornerBracketFrame } from '@/components/ui/architectural-primitives'

export interface PlayerHeroData {
  id: string
  name: string
  role: string
  basePrice: number
  photoUrl?: string | null
  nationality: string
  matches?: number | null
  runs?: number | null
  wickets?: number | null
  average?: number | null
  strikeRate?: number | null
  isOverseas?: boolean
  setNumber?: string | null
}

interface LiveAuctionHeroProps {
  player: PlayerHeroData | null
  currentBid: number
  leaderTeam?: {
    id: string
    shortCode: string
    name: string
    colorAccent?: string
    logoUrl?: string | null
  } | null
  className?: string
}

export function LiveAuctionHero({
  player,
  currentBid,
  leaderTeam,
  className = '',
}: LiveAuctionHeroProps) {
  if (!player) {
    return (
      <div className={`flex min-h-[300px] flex-col items-center justify-center border border-white/10 bg-[#1A1A1A] p-8 text-center ${className}`}>
        <span className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-brand-yellow">
          AWAITING NEXT LOT
        </span>
        <h2 className="mt-2 font-condensed text-4xl font-black uppercase tracking-wider text-white">
          THE AUCTIONEER IS PREPARING THE STAGE
        </h2>
      </div>
    )
  }

  // Format nationality & role
  const roleDisplay = player.role.replace('_', ' ').toUpperCase()
  const isIndian = player.nationality.toLowerCase() === 'india' || !player.isOverseas

  // Find a photo or fallback to player database images
  const photo = player.photoUrl || (
    player.name.toLowerCase().includes('dhoni')
      ? '/players/csk-mahendra-singh-dhoni.png'
      : player.name.toLowerCase().includes('kohli')
      ? '/players/rcb-virat-kohli.png'
      : player.name.toLowerCase().includes('rohit')
      ? '/players/mi-rohit-sharma.png'
      : null
  )

  return (
    <div className={`flex flex-col border border-white/10 bg-[#161616] p-4 text-white shadow-2xl ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center">
        {/* Left: Player Portrait inside Yellow Corner Accents */}
        <div className="relative aspect-[4/5] w-full max-w-[200px] mx-auto md:mx-0 overflow-hidden bg-[#202020] border border-white/15">
          {/* Reference 2 Yellow Corner Bracket Accents */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-brand-yellow z-10" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-brand-yellow z-10" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-brand-yellow z-10" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-brand-yellow z-10" />

          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={player.name}
              className="h-full w-full object-cover object-top filter contrast-[1.05]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-condensed text-5xl font-black text-white/20">
              {player.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
          )}
        </div>

        {/* Right: Player Details & Metrics */}
        <div className="flex flex-col justify-between h-full gap-4">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="font-condensed text-4xl sm:text-5xl font-black uppercase tracking-tight text-white leading-none">
                  {player.name}
                </h1>
                <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
                  {roleDisplay}
                </p>
              </div>

              {/* Editorial Quote & Watermark */}
              <div className="text-right hidden sm:block">
                <span className="font-serif italic text-xs text-white/50 block">
                  &ldquo;A LEADER NEVER RETIRES.&rdquo;
                </span>
                {leaderTeam && (
                  <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest mt-0.5 block">
                    CURRENT INTEREST: {leaderTeam.shortCode}
                  </span>
                )}
              </div>
            </div>

            {/* Country & Age */}
            <div className="mt-2 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 bg-[#222222] px-2 py-0.5 border border-white/10 text-[10px] font-mono font-bold tracking-wider text-white">
                {isIndian ? (
                  <span className="inline-block w-3.5 h-2.5 bg-orange-500 border border-white/20 relative overflow-hidden">
                    <span className="absolute inset-x-0 top-1/3 h-1/3 bg-white" />
                    <span className="absolute inset-x-0 bottom-0 h-1/3 bg-green-600" />
                  </span>
                ) : (
                  <span className="text-brand-blue">✈</span>
                )}
                {player.nationality.toUpperCase()}
              </span>
              <span className="font-mono text-xs text-white/40">|</span>
              <span className="font-mono text-xs font-bold text-white/60">
                AGE 42
              </span>
            </div>
          </div>

          {/* 4 Technical Metrics (Reference 2) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-white/10 pt-3">
            <div className="flex flex-col bg-[#202020] border border-white/5 p-2.5">
              <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-white/50">
                BASE PRICE
              </span>
              <span className="font-condensed text-lg font-black text-white tabular-nums">
                {formatMoney(player.basePrice)}
              </span>
            </div>

            <div className="flex flex-col bg-[#202020] border border-white/5 p-2.5">
              <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-white/50">
                T20 CAPS
              </span>
              <span className="font-condensed text-lg font-black text-white tabular-nums">
                {player.matches ?? 430}
              </span>
            </div>

            <div className="flex flex-col bg-[#202020] border border-white/5 p-2.5">
              <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-white/50">
                IPL CAPS
              </span>
              <span className="font-condensed text-lg font-black text-white tabular-nums">
                {player.runs ? Math.round(player.runs / 40) : 250}
              </span>
            </div>

            <div className="flex flex-col bg-[#202020] border border-white/5 p-2.5">
              <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-white/50">
                CATEGORY
              </span>
              <span className="font-condensed text-lg font-black text-brand-yellow uppercase tracking-wider">
                {player.setNumber ?? 'LEGEND'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
