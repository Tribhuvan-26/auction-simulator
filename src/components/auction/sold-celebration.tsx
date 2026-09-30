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
 * Perfectly anchored in the center of the screen without vertical fluctuations, jumping, glow, or frame numbers.
 */
export function SoldCelebration({
  trigger,
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

    // Complete lifecycle after 1700ms (750ms swing + 650ms hold + 300ms fade)
    timerRef.current = setTimeout(() => {
      setIsPlaying(false)
      onComplete?.()
    }, 1700)
  }, [onComplete])

  // Stepped frame progression: plays all 42 frames smoothly in-place (~18ms per frame)
  useEffect(() => {
    if (!isPlaying) return

    let animId: number | null = null
    let intervalId: NodeJS.Timeout | null = null
    let start: number | null = null
    const duration = 750 // ~18ms per frame for crisp, snappy bat swing

    // Use requestAnimationFrame in browser for buttery display-rate sync
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      const step = (time: number) => {
        if (start === null) start = time
        const elapsed = time - start
        const progress = Math.min(elapsed / duration, 1)
        const frame = Math.min(Math.floor(progress * FRAME_COUNT), FRAME_COUNT - 1)
        setCurrentFrame(frame)

        if (progress < 1) {
          animId = window.requestAnimationFrame(step)
        }
      }
      animId = window.requestAnimationFrame(step)
    }

    // Interval fallback for timer-based testing environments
    const startTime = Date.now()
    intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const frame = Math.min(Math.floor(progress * FRAME_COUNT), FRAME_COUNT - 1)
      setCurrentFrame(frame)
      if (progress >= 1 && intervalId) {
        clearInterval(intervalId)
      }
    }, 18)

    return () => {
      if (animId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(animId)
      }
      if (intervalId !== null) {
        clearInterval(intervalId)
      }
    }
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
      <div className="cricket-silhouette-wrapper flex items-center justify-center" aria-hidden="true">
        {/* Plain crisp solid white cricketer silhouette - NO glow, NO drop-shadow */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FRAME_PATHS[currentFrame]}
          alt="IPL Cricketer Silhouette"
          className="w-[150px] h-[119px] sm:w-[175px] sm:h-[139px] object-contain pointer-events-none select-none filter-none drop-shadow-none"
          draggable={false}
        />
      </div>
    </div>
  )
}
