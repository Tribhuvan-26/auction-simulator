'use client'

import React from 'react'
import { cn } from '@/lib/cn'

/**
 * Pulsing Pink Live Status Beacon
 * Strictly adheres to #EB547C from the color specification
 */
export function StatusBeacon({
  label = 'LIVE',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="anim-beacon absolute inline-flex h-full w-full rounded-full bg-brand-pink opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-pink" />
      </span>
      <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-brand-pink uppercase">
        {label}
      </span>
    </div>
  )
}

/**
 * Architectural Technical Label / Badge
 */
export function TechLabel({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode
  variant?: 'default' | 'blue' | 'yellow' | 'pink' | 'charcoal'
  className?: string
}) {
  const variantStyles = {
    default: 'border-white/15 bg-white/5 text-white/70',
    blue: 'border-brand-blue/50 bg-brand-blue/10 text-brand-blue',
    yellow: 'border-brand-yellow/50 bg-brand-yellow/10 text-brand-yellow',
    pink: 'border-brand-pink/50 bg-brand-pink/10 text-brand-pink',
    charcoal: 'border-brand-charcoal bg-[#181818] text-white/60',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.16em] uppercase',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

/**
 * Thin Architectural Divider with optional technical crosshairs
 */
export function ArchitecturalDivider({
  className,
  label,
}: {
  className?: string
  label?: string
}) {
  if (label) {
    return (
      <div className={cn('relative flex items-center justify-center my-4', className)}>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <span className="relative bg-[#141414] px-3 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
          {label}
        </span>
      </div>
    )
  }

  return <div className={cn('w-full border-t border-white/10 my-3', className)} />
}

/**
 * Architectural Photo / Element Frame with Yellow Corner Brackets
 */
export function CornerBracketFrame({
  children,
  className,
  accentColor = '#F9D47B',
}: {
  children: React.ReactNode
  className?: string
  accentColor?: string
}) {
  return (
    <div className={cn('relative p-1', className)}>
      {/* Top Left Bracket */}
      <span
        className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 pointer-events-none z-10"
        style={{ borderColor: accentColor }}
      />
      {/* Top Right Bracket */}
      <span
        className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 pointer-events-none z-10"
        style={{ borderColor: accentColor }}
      />
      {/* Bottom Left Bracket */}
      <span
        className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 pointer-events-none z-10"
        style={{ borderColor: accentColor }}
      />
      {/* Bottom Right Bracket */}
      <span
        className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 pointer-events-none z-10"
        style={{ borderColor: accentColor }}
      />
      {children}
    </div>
  )
}

/**
 * Technical Data Display Cell
 */
export function TechnicalCell({
  label,
  value,
  subvalue,
  className,
  highlight = false,
}: {
  label: string
  value: React.ReactNode
  subvalue?: string
  className?: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col border border-white/10 bg-[#1A1A1A] p-2.5 transition-colors',
        highlight && 'border-brand-blue/60 bg-brand-blue/5',
        className
      )}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">
        {label}
      </span>
      <span className="mt-1 font-heading text-lg font-bold tracking-tight text-white tabular-nums">
        {value}
      </span>
      {subvalue && (
        <span className="font-mono text-[10px] text-white/40">{subvalue}</span>
      )}
    </div>
  )
}

/**
 * Concrete Panel Base Plate
 */
export function ConcretePanel({
  title,
  rightElement,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  rightElement?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col border border-white/12 bg-[#181818] shadow-brutal',
        className
      )}
    >
      {title && (
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#202020] px-3.5 py-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
            {title}
          </span>
          {rightElement}
        </div>
      )}
      <div className={cn('min-h-0 flex-1 p-3', bodyClassName)}>{children}</div>
    </div>
  )
}
