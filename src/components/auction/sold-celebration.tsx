'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'

export interface SoldCelebrationPlayer {
  name: string
  price?: number | string
  teamName?: string
}

export interface SoldCelebrationProps {
  /**
   * Optional key or counter that triggers the animation when changed.
   */
  trigger?: number | string | null
  /**
   * Optional manual active state override.
   */
  active?: boolean
  /**
   * Callback invoked when the celebration animation finishes (~2.4s).
   */
  onComplete?: () => void
  /**
   * Optional player data. When provided, displays the luxury "PLAYER ACQUIRED!" modal.
   * If omitted (or when badgeOnly is true), displays the centered animated cricketer badge.
   */
  player?: SoldCelebrationPlayer | null
  /**
   * Custom headline text (defaults to 'PLAYER ACQUIRED!')
   */
  title?: string
  /**
   * Custom eyebrow text (defaults to 'IPL Auction 2026')
   */
  eyebrow?: string
  /**
   * Force badge-only mode without text elements (ideal for transitions)
   */
  badgeOnly?: boolean
}

function formatPrice(val?: number | string): string | null {
  if (val === undefined || val === null || val === '') return null
  if (typeof val === 'string') return val
  if (val >= 10000000) {
    const cr = val / 10000000
    return `₹${cr.toFixed(2)} CR`
  }
  if (val >= 100000) {
    const lk = val / 100000
    return `₹${lk % 1 === 0 ? lk.toFixed(0) : lk.toFixed(1)} LAKH`
  }
  return `₹${val.toLocaleString('en-IN')}`
}

/**
 * Official IPL Cricket Pop-up Animation & Modal.
 *
 * Utilizes the official 42-frame sprite sheet with smooth cel-stepped bat swing animation,
 * radial masking, chromatic gradients, and broadcast pop-in physics.
 */
export function SoldCelebration({
  trigger,
  active,
  onComplete,
  player: initialPlayer,
  title,
  eyebrow,
  badgeOnly,
}: SoldCelebrationProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playKey, setPlayKey] = useState(0)
  const [activePlayer, setActivePlayer] = useState<SoldCelebrationPlayer | null>(initialPlayer ?? null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTriggerRef = useRef<number | string | null>(null)

  useEffect(() => {
    if (initialPlayer !== undefined) {
      setActivePlayer(initialPlayer)
    }
  }, [initialPlayer])

  const startAnimation = useCallback((overridePlayer?: SoldCelebrationPlayer | null) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    if (overridePlayer !== undefined) {
      setActivePlayer(overridePlayer)
    }
    setPlayKey((k) => k + 1)
    setIsPlaying(true)

    // Complete lifecycle after 2400ms (matches CSS animation duration)
    timerRef.current = setTimeout(() => {
      setIsPlaying(false)
      onComplete?.()
    }, 2400)
  }, [onComplete])

  // Watch trigger prop changes (only trigger when positive number or new value, never on initial 0)
  useEffect(() => {
    if (trigger === undefined || trigger === null) return
    if (typeof trigger === 'number' && trigger <= 0) {
      lastTriggerRef.current = trigger
      return
    }
    if (trigger !== lastTriggerRef.current) {
      lastTriggerRef.current = trigger
      startAnimation(initialPlayer)
    }
  }, [trigger, initialPlayer, startAnimation])

  // Watch manual active prop
  useEffect(() => {
    if (active && !isPlaying) {
      startAnimation(initialPlayer)
    }
  }, [active, isPlaying, initialPlayer, startAnimation])

  // Listen to window-level custom events & expose global trigger
  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ type?: string; player?: SoldCelebrationPlayer }>
      if (!customEvent.detail || customEvent.detail.type === 'SOLD' || !customEvent.detail.type) {
        startAnimation(customEvent.detail?.player ?? initialPlayer)
      }
    }

    window.addEventListener('auction:sold', handleCustomEvent)
    window.addEventListener('auction:play-sold', handleCustomEvent)

    // Expose global window function for direct execution
    ;(window as unknown as { showSoldAnimation: (player?: SoldCelebrationPlayer) => void }).showSoldAnimation = (p) => {
      startAnimation(p ?? initialPlayer)
    }

    return () => {
      window.removeEventListener('auction:sold', handleCustomEvent)
      window.removeEventListener('auction:play-sold', handleCustomEvent)
    }
  }, [initialPlayer, startAnimation])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  if (!isPlaying) return null

  const isCardMode = !badgeOnly && !!activePlayer
  const formattedPrice = activePlayer?.price ? formatPrice(activePlayer.price) : null

  return (
    <main
      key={playKey}
      data-testid="sold-celebration-overlay"
      className="auction-overlay select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="acquired-title"
    >
      {isCardMode ? (
        <article className="auction-card">
          <div className="sprite-badge" aria-hidden="true">
            <div className="cricket-sprite" />
          </div>

          <p className="eyebrow-ipl">{eyebrow || 'IPL Auction 2026'}</p>
          <h1 id="acquired-title" className="acquired-heading font-heading font-black">
            {title || 'PLAYER ACQUIRED!'}
          </h1>
          <p className="player-name-ipl">{activePlayer?.name}</p>

          {formattedPrice && (
            <div
              className="price-badge-ipl font-mono"
              aria-label={`Acquired for ${formattedPrice}`}
            >
              {formattedPrice}
            </div>
          )}

          <p className="sr-only">
            {activePlayer?.name} has been acquired{formattedPrice ? ` for ${formattedPrice}` : ''}.
          </p>
        </article>
      ) : (
        <div
          className="sprite-badge badge-standalone"
          aria-hidden="true"
        >
          <div className="cricket-sprite" />
        </div>
      )}
    </main>
  )
}
