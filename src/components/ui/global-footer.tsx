import React from 'react'
import { cn } from '@/lib/cn'

/**
 * Architectural Global Telemetry Footer
 * Features technical metadata and the 5-color palette reference strip.
 */
export function GlobalFooter({
  telemetryText = '// IPL AUCTION CONTROL SYSTEM v3.0 // DEPLOYED // REALTIME POSTGRES ENGINE //',
  tagline = 'MORE THAN A TOURNAMENT. A LEGACY IN MOTION.',
  year,
  className,
}: {
  telemetryText?: string
  tagline?: string
  year?: string
  className?: string
}) {
  const palette = [
    { hex: '#2074D5', name: 'BLUE', bg: 'bg-[#2074D5]' },
    { hex: '#F9D47B', name: 'YELLOW', bg: 'bg-[#F9D47B]' },
    { hex: '#EB547C', name: 'PINK', bg: 'bg-[#EB547C]' },
    { hex: '#FFFFFF', name: 'WHITE', bg: 'bg-[#FFFFFF]' },
    { hex: '#282828', name: 'CHARCOAL', bg: 'bg-[#282828]' },
  ]

  return (
    <footer
      className={cn(
        'relative z-20 flex flex-wrap items-center justify-between border-t border-white/10 bg-black/40 px-4 py-2 font-mono text-[10px] tracking-[0.14em] text-white/50 backdrop-blur-md md:px-8',
        className
      )}
    >
      {/* Left: Telemetry string */}
      <div className="flex items-center gap-3">
        <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
        <span className="truncate">{telemetryText}</span>
      </div>

      {/* Center: Brand tagline */}
      <div className="hidden lg:flex items-center text-white/40 tracking-[0.2em] uppercase text-[9px]">
        MORE THAN A TOURNAMENT. A LEGACY IN MOTION.
      </div>

      {/* Right: Technical Palette Swatch Strip */}
      <div className="flex items-center gap-1.5 select-none" title="Architectural System Palette">
        <span className="text-[8px] text-white/30 mr-1 hidden sm:inline">PALETTE</span>
        {palette.map((c) => (
          <div
            key={c.hex}
            className={cn('h-2.5 w-5 border border-white/20', c.bg)}
            title={`${c.name}: ${c.hex}`}
          />
        ))}
      </div>
    </footer>
  )
}
