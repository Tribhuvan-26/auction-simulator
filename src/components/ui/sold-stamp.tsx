'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ConfettiBurst } from '@/components/ui/confetti-burst'

/**
 * Full-screen SOLD/UNSOLD overlay, GSAP timeline per the spec:
 * SOLD  — white flash (~150ms) -> stamp slams down (scale 2->1, slight
 *         rotation, overshoot-settle, ~0.5s) -> confetti burst -> hold.
 * UNSOLD — desaturate pulse -> horizontal shake -> fade, no confetti.
 * Mount this component for the duration of the moment; unmount to end it.
 */
export function SoldStamp({ kind }: { kind: 'SOLD' | 'UNSOLD' }) {
  const flashRef = useRef<HTMLDivElement>(null)
  const stampRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true
    const flash = flashRef.current
    const stamp = stampRef.current
    if (!flash || !stamp) return

    if (reduceMotion) {
      gsap.set(flash, { opacity: 0 })
      gsap.set(stamp, { opacity: 1, scale: 1, rotate: kind === 'SOLD' ? -7 : 0 })
      return
    }

    const tl = gsap.timeline()
    if (kind === 'SOLD') {
      tl.set(flash, { opacity: 0.9 })
        .to(flash, { opacity: 0, duration: 0.15, ease: 'power1.out' })
        .fromTo(
          stamp,
          { scale: 2.4, rotate: -14, opacity: 0 },
          { scale: 1, rotate: -7, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' },
          '<'
        )
    } else {
      tl.set(flash, { opacity: 0 })
        .fromTo(stamp, { opacity: 0, filter: 'saturate(0.3)' }, { opacity: 1, duration: 0.2 })
        .to(stamp, {
          x: '+=8',
          duration: 0.06,
          repeat: 5,
          yoyo: true,
          ease: 'power1.inOut',
        })
        .to(stamp, { filter: 'saturate(1)', duration: 0.3 })
    }

    return () => {
      tl.kill()
    }
  }, [kind])

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
      <div ref={flashRef} className="absolute inset-0 bg-brand-white" />
      {kind === 'SOLD' && <ConfettiBurst />}
      <p
        ref={stampRef}
        className={`border-[10px] px-12 py-6 font-heading text-8xl font-bold ${
          kind === 'SOLD'
            ? 'border-brand-pink bg-brand-white text-brand-pink'
            : 'border-brand-charcoal bg-brand-white/80 text-brand-charcoal'
        }`}
      >
        {kind}
      </p>
    </div>
  )
}
