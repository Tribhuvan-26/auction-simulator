'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { cn } from '@/lib/cn'

/**
 * Ticks from the previous value to the next over ~0.4s instead of snapping —
 * the "digit-by-digit tick up" the brief asks for, driven by a GSAP tween on
 * a plain counter object (onUpdate writes the rounded value into state).
 * Respects prefers-reduced-motion by snapping immediately.
 */
export function BidNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value)
  const counter = useRef({ n: value })

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true
    if (reduceMotion || counter.current.n === value) {
      counter.current.n = value
      setDisplay(value)
      return
    }
    const tween = gsap.to(counter.current, {
      n: value,
      duration: 0.4,
      ease: 'power3.out',
      onUpdate: () => setDisplay(Math.round(counter.current.n)),
    })
    return () => {
      tween.kill()
    }
  }, [value])

  return <span className={cn('font-heading font-bold tabular-nums', className)}>{display}</span>
}
