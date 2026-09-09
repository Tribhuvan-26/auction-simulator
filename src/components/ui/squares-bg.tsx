'use client'

import { useEffect, useRef } from 'react'

/**
 * Drifting square grid for the console stage — modelled on React Bits'
 * "Squares" background.
 *
 * React Bits ships by copy-paste (jsrepo / shadcn registry), and neither
 * `npx jsrepo add https://reactbits.dev/ts/tailwind/Backgrounds/Squares` nor
 * the registry JSON resolves from here — both return the site's SPA shell —
 * and the npm package called `react-bits` is an unrelated library. So this is
 * a local implementation of the same idea: hard 1px grid lines scrolling on a
 * diagonal, the square under the cursor filling, and a radial mask sinking the
 * edges into the ground. Canvas rather than a thousand DOM nodes.
 */
export function SquaresBg({
  squareSize = 52,
  speed = 0.35,
  lineColor = 'rgba(255,255,255,0.14)',
  hoverFill = 'rgba(32,116,213,0.22)',
  className,
}: {
  squareSize?: number
  speed?: number
  lineColor?: string
  hoverFill?: string
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let width = 0
    let height = 0
    let offset = 0
    let frame = 0
    const hover = { x: -1, y: -1 }

    function resize() {
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)

      // Both axes share one offset, so the grid slides on the diagonal.
      const shift = offset % squareSize
      const startX = -squareSize + shift
      const startY = -squareSize + shift

      // The square under the cursor, filled before the lines so the strokes
      // stay crisp on top of it.
      if (hover.x >= 0) {
        const col = Math.floor((hover.x - startX) / squareSize)
        const row = Math.floor((hover.y - startY) / squareSize)
        ctx.fillStyle = hoverFill
        ctx.fillRect(startX + col * squareSize, startY + row * squareSize, squareSize, squareSize)
      }

      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = startX; x <= width + squareSize; x += squareSize) {
        ctx.moveTo(Math.round(x) + 0.5, 0)
        ctx.lineTo(Math.round(x) + 0.5, height)
      }
      for (let y = startY; y <= height + squareSize; y += squareSize) {
        ctx.moveTo(0, Math.round(y) + 0.5)
        ctx.lineTo(width, Math.round(y) + 0.5)
      }
      ctx.stroke()

      // Sink the edges so the grid reads as depth rather than wallpaper.
      const mask = ctx.createRadialGradient(
        width * 0.32,
        height * 0.42,
        0,
        width * 0.32,
        height * 0.42,
        Math.max(width, height) * 0.95
      )
      mask.addColorStop(0, 'rgba(10,15,24,0)')
      mask.addColorStop(0.6, 'rgba(10,15,24,0.3)')
      mask.addColorStop(1, 'rgba(10,15,24,0.9)')
      ctx.fillStyle = mask
      ctx.fillRect(0, 0, width, height)
    }

    function tick() {
      offset += speed
      draw()
      frame = requestAnimationFrame(tick)
    }

    function onPointerMove(e: PointerEvent) {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      hover.x = e.clientX - rect.left
      hover.y = e.clientY - rect.top
    }

    function onPointerLeave() {
      hover.x = -1
      hover.y = -1
    }

    resize()
    draw()
    const observer = new ResizeObserver(() => {
      resize()
      draw()
    })
    observer.observe(canvas)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerleave', onPointerLeave)
    if (!reduceMotion) frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [squareSize, speed, lineColor, hoverFill])

  return <canvas ref={ref} aria-hidden className={className} />
}
