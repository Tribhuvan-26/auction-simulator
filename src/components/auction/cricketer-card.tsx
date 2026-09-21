'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Maximize2, X, Shield, Activity, Award, Flame, Globe } from 'lucide-react'
import { formatMoney } from '@/lib/money'

export interface CricketerCardProps {
  player: {
    id: string
    name: string
    role: string
    basePrice: number
    photoUrl: string | null
    nationality: string
    matches: number
    runs?: number | null
    wickets?: number | null
    average?: number | null
    strikeRate?: number | null
    economy?: number | null
    isOverseas?: boolean
    setNumber?: string
  }
  teamName?: string
  teamColor?: string
  compact?: boolean
  className?: string
}

export function CricketerCard({
  player,
  teamName = 'IPL AUCTION POOL',
  teamColor = '#2074D5',
  compact = false,
  className = '',
}: CricketerCardProps) {
  const [expanded, setExpanded] = useState(false)

  const roleClean = player.role.replace('_', ' ').toUpperCase()
  const isBowler = roleClean.includes('BOWL')
  const isAllRounder = roleClean.includes('ALL')

  return (
    <>
      {/* ── Vertical Card (Fits Next Lot Space & Component Slots) ── */}
      <div
        onClick={() => setExpanded(true)}
        className={`group relative flex flex-col border border-white/15 bg-[#141417]/95 p-3.5 backdrop-blur-md shadow-xl transition-all duration-300 hover:border-white/40 hover:shadow-2xl cursor-pointer select-none ${className}`}
        style={{
          boxShadow: `0 0 15px ${teamColor}20`,
        }}
      >
        {/* Top Header Tag */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/60 truncate max-w-[130px]">
            {player.setNumber || 'PLAYER PROFILE'}
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold text-brand-yellow">
            <span>EXPAND</span>
            <Maximize2 className="h-3 w-3 transition-transform group-hover:scale-125" />
          </div>
        </div>

        {/* Player Photo Frame */}
        <div
          className="relative aspect-square w-full overflow-hidden border bg-[#0C0C0E] mb-3 flex items-center justify-center"
          style={{ borderColor: `${teamColor}60` }}
        >
          {player.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.photoUrl}
              alt={player.name}
              className="h-full w-full object-cover object-top filter contrast-[1.05] transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-3 text-center">
              <span className="font-condensed text-4xl font-black text-white/20">
                {player.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="font-mono text-[8px] tracking-widest text-white/40 mt-1">
                {player.nationality}
              </span>
            </div>
          )}

          {/* Overseas indicator badge */}
          {player.isOverseas && (
            <div className="absolute top-2 right-2 bg-[#2074D5] text-white font-mono text-[8px] font-black px-1.5 py-0.5 uppercase tracking-wider shadow">
              OVERSEAS
            </div>
          )}
        </div>

        {/* Name & Role Banner */}
        <div
          className="px-2.5 py-1.5 mb-2.5 shadow-sm"
          style={{ backgroundColor: teamColor }}
        >
          <h3 className="font-condensed text-lg sm:text-xl font-black uppercase tracking-tight text-white leading-tight truncate">
            {player.name}
          </h3>
          <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-white/90 truncate">
            {roleClean} • {player.nationality}
          </p>
        </div>

        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 gap-1.5 bg-white/5 border border-white/10 p-2 mb-2.5">
          <div>
            <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
              BASE PRICE
            </span>
            <span className="font-condensed text-sm font-black text-brand-yellow tabular-nums block">
              {formatMoney(player.basePrice)}
            </span>
          </div>

          <div>
            <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
              MATCHES
            </span>
            <span className="font-condensed text-sm font-black text-white tabular-nums block">
              {player.matches}
            </span>
          </div>

          <div>
            <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
              {isBowler ? 'WICKETS' : 'RUNS'}
            </span>
            <span className="font-condensed text-sm font-black text-white tabular-nums block">
              {isBowler ? (player.wickets ?? 0) : (player.runs ?? 0)}
            </span>
          </div>

          <div>
            <span className="font-mono text-[8px] uppercase tracking-wider text-white/40 block">
              {isBowler ? 'ECONOMY' : 'STRIKE RATE'}
            </span>
            <span className="font-condensed text-sm font-black text-white tabular-nums block">
              {isBowler ? (player.economy ?? '—') : (player.strikeRate ?? '—')}
            </span>
          </div>
        </div>

        {/* Footer info pill */}
        <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-2 font-mono text-[8px] text-white/50">
          <span>{teamName}</span>
          <span className="text-white/80 font-bold">CLICK FOR FULL STATS</span>
        </div>
      </div>

      {/* ── Expandable Modal Dialog (Full Cricket Analytics) ── */}
      <AnimatePresence>
        {expanded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpanded(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-10 flex w-full max-w-2xl flex-col border border-white/20 bg-[#121215] text-white shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden"
              style={{
                boxShadow: `0 0 40px ${teamColor}35`,
              }}
            >
              {/* Modal Top Strip */}
              <div
                className="flex items-center justify-between px-5 py-3 border-b border-white/15"
                style={{ backgroundColor: `${teamColor}25` }}
              >
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" style={{ color: teamColor }} />
                  <span className="font-mono text-xs font-black uppercase tracking-[0.2em] text-white">
                    CRICKETER ANALYTICS // DOSSIER
                  </span>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="rounded border border-white/20 p-1 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6">
                {/* Framed Big Photo */}
                <div className="flex flex-col gap-3">
                  <div
                    className="relative aspect-square w-full overflow-hidden border-2 bg-[#0C0C0E] shadow-2xl flex items-center justify-center"
                    style={{
                      borderColor: teamColor,
                      boxShadow: `0 0 20px ${teamColor}40`,
                    }}
                  >
                    {player.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={player.photoUrl}
                        alt={player.name}
                        className="h-full w-full object-cover object-top filter contrast-[1.05]"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-4">
                        <span className="font-condensed text-6xl font-black text-white/20">
                          {player.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-white/50 mt-1">
                          {player.nationality}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Valuation Plate */}
                  <div className="flex flex-col bg-[#1C1C20] border border-white/15 p-3">
                    <span className="font-mono text-[8px] font-black uppercase tracking-wider text-white/50">
                      BASE VALUATION
                    </span>
                    <span className="font-condensed text-2xl font-black text-brand-yellow mt-0.5 tabular-nums">
                      {formatMoney(player.basePrice)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[9px]">
                    <Globe className="h-3 w-3 text-white/60" />
                    <span className="text-white/80">{player.nationality}</span>
                    {player.isOverseas && (
                      <span className="ml-auto bg-[#2074D5] px-1 py-0.2 text-[7px] font-black text-white uppercase">
                        Overseas
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Details & Detailed Stats Matrix */}
                <div className="flex flex-col justify-between gap-4">
                  <div>
                    <div
                      className="px-4 py-2.5 mb-3 shadow-md"
                      style={{ backgroundColor: teamColor }}
                    >
                      <h2 className="font-condensed text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-tight">
                        {player.name}
                      </h2>
                      <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-white/90 mt-0.5">
                        {roleClean} • {player.setNumber || 'IPL 2026 PLAYER'}
                      </p>
                    </div>

                    <p className="font-mono text-xs text-white/60 leading-relaxed mb-4">
                      Official IPL registered profile for {player.name}. Verified franchise auction registry
                      data with verified bowling, batting, and match performance metrics.
                    </p>
                  </div>

                  {/* Full Stats Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="flex flex-col border border-white/10 bg-[#18181C] p-2.5">
                      <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/40">
                        MATCHES
                      </span>
                      <span className="font-condensed text-2xl font-black text-white tabular-nums mt-0.5">
                        {player.matches}
                      </span>
                    </div>

                    <div className="flex flex-col border border-white/10 bg-[#18181C] p-2.5">
                      <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/40">
                        TOTAL RUNS
                      </span>
                      <span className="font-condensed text-2xl font-black text-brand-yellow tabular-nums mt-0.5">
                        {player.runs ?? '—'}
                      </span>
                    </div>

                    <div className="flex flex-col border border-white/10 bg-[#18181C] p-2.5">
                      <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/40">
                        WICKETS
                      </span>
                      <span className="font-condensed text-2xl font-black text-[#EB547C] tabular-nums mt-0.5">
                        {player.wickets ?? '—'}
                      </span>
                    </div>

                    <div className="flex flex-col border border-white/10 bg-[#18181C] p-2.5">
                      <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/40">
                        BATTING AVG
                      </span>
                      <span className="font-condensed text-2xl font-black text-white tabular-nums mt-0.5">
                        {player.average ?? '—'}
                      </span>
                    </div>

                    <div className="flex flex-col border border-white/10 bg-[#18181C] p-2.5">
                      <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/40">
                        STRIKE RATE
                      </span>
                      <span className="font-condensed text-2xl font-black text-[#2074D5] tabular-nums mt-0.5">
                        {player.strikeRate ?? '—'}
                      </span>
                    </div>

                    <div className="flex flex-col border border-white/10 bg-[#18181C] p-2.5">
                      <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/40">
                        ECONOMY
                      </span>
                      <span className="font-condensed text-2xl font-black text-white/90 tabular-nums mt-0.5">
                        {player.economy ?? '—'}
                      </span>
                    </div>
                  </div>

                  {/* Close Action Bar */}
                  <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                      PRESS ESC OR CLICK OUTSIDE TO CLOSE
                    </span>
                    <button
                      onClick={() => setExpanded(false)}
                      className="px-4 py-1.5 font-mono text-xs font-black uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                      DISMISS
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
