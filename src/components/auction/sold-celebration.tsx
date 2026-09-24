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

const FRAME_COUNT = 42
const FRAME_PATHS = Array.from({ length: FRAME_COUNT }, (_, i) =>
  `/assets/brand/cricket-frames/frame_${String(i + 1).padStart(2, '0')}.png`
)

/**
 * Official IPL Cricket Pop-up Animation.
 *
 * Renders the pure white cricketer silhouette bat swing animation against a dimmed background.
 * Displays exactly one isolated frame at a time without frame numbers, borders, or scrolling seams.
 */
export function SoldCelebration({
  trigger,
  active,
  onComplete,
}: SoldCelebrationProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playKey, setPlayKey] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTriggerRef = useRef<number | string | null>(null)

  // Preload all 42 isolated frames into browser memory on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      FRAME_PATHS.forEach((path) => {
        const img = new Image()
        img.src = path
      })
    }
  }, [])

  const startAnimation = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setCurrentFrame(0)
    setPlayKey((k) => k + 1)
    setIsPlaying(true)

    // Complete lifecycle after 2400ms (matches CSS animation duration)
    timerRef.current = setTimeout(() => {
      setIsPlaying(false)
      onComplete?.()
    }, 2400)
  }, [onComplete])

  // Stepped frame progression: plays all 42 frames smoothly in-place (~24ms per frame)
  useEffect(() => {
    if (!isPlaying) return

    setCurrentFrame(0)
    const startTime = Date.now()
    const totalDuration = 1008 // 42 frames * 24ms

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / totalDuration, 1)
      const index = Math.min(Math.floor(progress * FRAME_COUNT), FRAME_COUNT - 1)
      setCurrentFrame(index)

      if (progress >= 1) {
        clearInterval(interval)
      }
    }, 24)

    return () => clearInterval(interval)
  }, [isPlaying, playKey])

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FRAME_PATHS[currentFrame]}
          alt="IPL Cricketer Silhouette"
          className="w-[210px] h-[164px] sm:w-[240px] sm:h-[188px] object-contain filter drop-shadow-[0_0_18px_rgba(255,255,255,0.6)] pointer-events-none select-none transition-none"
          draggable={false}
        />
      </div>
    </div>
  )
}
