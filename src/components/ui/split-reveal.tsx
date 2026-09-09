'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { cn } from '@/lib/cn'

gsap.registerPlugin(SplitText)

/**
 * Per-character reveal for the name of the player coming onto the block —
 * characters rise and unblur in a stagger. Re-runs whenever `trigger` changes
 * (pass the lot id), which is the moment the auctioneer loads the next player.
 *
 * GSAP 3.13 made SplitText free, so this is the real plugin rather than a
 * hand-rolled character splitter — it handles wrapping and screen readers
 * (the original text stays available via aria).
 */
export function SplitReveal({
  text,
  trigger,
  className,
  blur = true,
  delay = 0,
}: {
  text: string
  trigger: string
  className?: string
  blur?: boolean
  delay?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true
    if (reduceMotion) {
      gsap.set(el, { opacity: 1 })
      return
    }

    const split = new SplitText(el, { type: 'chars' })
    const tween = gsap.fromTo(
      split.chars,
      { yPercent: 55, opacity: 0, filter: blur ? 'blur(10px)' : 'blur(0px)' },
      {
        yPercent: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.55,
        delay,
        ease: 'power3.out',
        stagger: 0.028,
      }
    )

    return () => {
      tween.kill()
      split.revert()
    }
  }, [trigger, text, blur, delay])

  return (
    <span ref={ref} className={cn('inline-block', className)}>
      {text}
    </span>
  )
}
