'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

const COLORS = ['#2074D5', '#F9D47B', '#EB547C']
const PIECE_COUNT = 28

function generatePieces() {
  return Array.from({ length: PIECE_COUNT }, (_, i) => {
    const angle = (i / PIECE_COUNT) * 360 + Math.random() * 20
    const distance = 140 + Math.random() * 120
    const rad = (angle * Math.PI) / 180
    return {
      id: i,
      color: COLORS[i % COLORS.length],
      x: Math.cos(rad) * distance,
      y: Math.sin(rad) * distance,
      rotate: Math.random() * 720 - 360,
      size: 8 + Math.random() * 6,
    }
  })
}

/**
 * Brand-color-only confetti for the SOLD moment — a GSAP stagger flings each
 * piece outward and fades it, no canvas or confetti library. Mount this
 * component to trigger a single burst; it doesn't remove itself.
 */
export function ConfettiBurst() {
  const [pieces] = useState(generatePieces)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const els = container.querySelectorAll<HTMLElement>('[data-confetti-piece]')
    const tweens = Array.from(els).map((el, i) =>
      gsap.to(el, {
        x: pieces[i].x,
        y: pieces[i].y,
        rotate: pieces[i].rotate,
        opacity: 0,
        duration: 0.9,
        delay: Math.random() * 0.08,
        ease: 'power2.out',
      })
    )
    return () => tweens.forEach((t) => t.kill())
  }, [pieces])

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          data-confetti-piece
          className="absolute border-2 border-brand-charcoal"
          style={{ backgroundColor: p.color, width: p.size, height: p.size }}
        />
      ))}
    </div>
  )
}
