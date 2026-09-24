'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'

export interface SoldCelebrationProps {
  /**
   * Optional key or counter that triggers the animation when changed.
   */
  trigger?: number | string | null
  /**
   * Callback invoked when the celebration animation finishes (~2.2s).
   */
  onComplete?: () => void
}

/**
 * Premium International Cricket Broadcast "Player Sold" Celebration.
 * 
 * Features:
 * - 100% pure white authentic IPL cricketer silhouette emblem & swoosh.
 * - Independent multi-layer kinetic swing: bat whip, arm follow-through,
 *   athletic body drive, and dynamic swoosh illumination.
 * - Broadcast pop-in with elegant scale overshoot and smooth upward drift exit.
 * - Pure SVG + hardware-accelerated GPU transforms.
 * - Zero layout shifts; pointer-events-none overlay.
 * - No text, no background cards, no colored glows.
 * - Supports repeated triggers without page reloads.
 */
export function SoldCelebration({
  trigger,
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

    // Complete lifecycle after 2200ms (matches CSS animation duration)
    timerRef.current = setTimeout(() => {
      setIsPlaying(false)
      onComplete?.()
    }, 2200)
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
    ;(window as unknown as { showSoldAnimation: () => void }).showSoldAnimation = startAnimation

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
      className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center select-none overflow-hidden bg-black/60 backdrop-blur-[2px] transition-all duration-300"
      style={{
        animation: 'sold-overlay-bg 2.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
      aria-hidden="true"
    >
      {/* Centered Cricketer Emblem Container - Compact, smaller & elegant */}
      <div
        className="sold-emblem-root relative flex items-center justify-center w-[120px] h-[174px] sm:w-[145px] sm:h-[210px] md:w-[165px] md:h-[239px]"
        style={{
          animation: 'sold-emblem-pop 2.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          willChange: 'transform, opacity',
        }}
      >
        {/* Multi-Layer Animated Cricketer SVG */}
        <svg
          viewBox="0 0 252 365"
          className="w-full h-full object-contain filter drop-shadow-[0_0_18px_rgba(255,255,255,0.4)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle minimal white motion streak behind bat stroke */}
          <path
            d="M 12 110 C 14 82, 32 50, 72 32"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            className="sold-motion-streak"
            style={{
              animation: 'sold-streak-flash 2.2s ease-out forwards',
              strokeDasharray: '120',
              willChange: 'opacity, stroke-dashoffset',
            }}
          />

          {/* Layer 1: Swoosh (Orbital motion trail) */}
          <g
            id="cricketer-layer-swoosh"
            className="sold-swoosh"
            style={{
              transformOrigin: '125px 120px',
              animation: 'sold-swoosh-pulse 2.2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
              willChange: 'transform, opacity',
            }}
          >
            <image
              href="/assets/brand/cricketer-swoosh.png"
              width="252"
              height="365"
              preserveAspectRatio="xMidYMid meet"
            />
          </g>

          {/* Layer 2: Body (Head, helmet, torso, legs, pads) */}
          <g
            id="cricketer-layer-body"
            className="sold-body"
            style={{
              transformOrigin: '105px 230px',
              animation: 'sold-body-shift 2.2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
              willChange: 'transform',
            }}
          >
            <image
              href="/assets/brand/cricketer-body.png"
              width="252"
              height="365"
              preserveAspectRatio="xMidYMid meet"
            />
          </g>

          {/* Layer 3: Arms (Shoulders, forearms, hands gripping handle) */}
          <g
            id="cricketer-layer-arms"
            className="sold-arms"
            style={{
              transformOrigin: '110px 105px',
              animation: 'sold-arms-follow 2.2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
              willChange: 'transform',
            }}
          >
            <image
              href="/assets/brand/cricketer-arms.png"
              width="252"
              height="365"
              preserveAspectRatio="xMidYMid meet"
            />
          </g>

          {/* Layer 4: Cricket Bat (Handle & blade with high-speed rotational swing) */}
          <g
            id="cricketer-layer-bat"
            className="sold-bat"
            style={{
              transformOrigin: '82px 92px',
              animation: 'sold-bat-whip 2.2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
              willChange: 'transform',
            }}
          >
            <image
              href="/assets/brand/cricketer-bat.png"
              width="252"
              height="365"
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        </svg>
      </div>
    </div>
  )
}
