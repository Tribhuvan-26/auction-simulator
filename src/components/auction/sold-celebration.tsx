'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'

export interface SoldCelebrationPlayer {
  name?: string
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
   * Optional player data (reserved for future use).
   */
  player?: SoldCelebrationPlayer | null
  /**
   * Optional toggle to show player card (defaults to false for pure cricketer silhouette).
   */
  showCard?: boolean
}

/**
 * Official IPL Cricket Pop-up Animation.
 *
 * Renders the pure white cricketer silhouette bat swing animation against a dimmed background.
 * No circular rings, no borders, no text.
 */
export function SoldCelebration({
  trigger,
  active,
  onComplete,
}: SoldCelebrationProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playKey, setPlayKey] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTriggerRef = useRef<number | string | null>(null)

  const startAnimation = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
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
      startAnimation()
    }
  }, [trigger, startAnimation])

  // Watch manual active prop
  useEffect(() => {
    if (active && !isPlaying) {
      startAnimation()
    }
  }, [active, isPlaying, startAnimation])

  // Listen to window-level custom events & expose global trigger
  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ type?: string }>
      if (!customEvent.detail || customEvent.detail.type === 'SOLD' || !customEvent.detail.type) {
        startAnimation()
      }
    }

    window.addEventListener('auction:sold', handleCustomEvent)
    window.addEventListener('auction:play-sold', handleCustomEvent)

    // Expose global window function for direct execution
    ;(window as unknown as { showSoldAnimation: () => void }).showSoldAnimation = () => {
      startAnimation()
    }

    return () => {
      window.removeEventListener('auction:sold', handleCustomEvent)
      window.removeEventListener('auction:play-sold', handleCustomEvent)
    }
  }, [startAnimation])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  if (!isPlaying) return null

  return (
    <div
      key={playKey}
      data-testid="sold-celebration-overlay"
      className="auction-overlay select-none pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="IPL Celebration"
    >
      <div className="cricket-silhouette-wrapper" aria-hidden="true">
        <div className="cricket-sprite" />
      </div>
    </div>
  )
}
