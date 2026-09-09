'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

/**
 * Spec's "lot change" animation: incoming card slides in and settles with a
 * slight overshoot. Call with a value that changes once per lot (the lot id) —
 * re-running the tween is the entrance; there's no matching exit for the
 * outgoing card since React already unmounts it in the same commit.
 */
export function useLotEntrance<T extends HTMLElement>(dependency: string) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true
    if (reduceMotion) return
    const tween = gsap.fromTo(
      el,
      { y: -24, rotate: 1.5, opacity: 0 },
      { y: 0, rotate: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.7)' }
    )
    return () => {
      tween.kill()
    }
  }, [dependency])

  return ref
}
