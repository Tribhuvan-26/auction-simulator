'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import layout from '../../../public/assets/landing/layers/layers.json'

/**
 * Landing backdrop: the Figma courtyard cut into parts by
 * scripts/landing_layers.py (boxes in layers.json, image px of 1536x1024).
 *   banners  sway from their top edge (cut whole, through the glass; case-lines and
 *            wall-front redraw what stands in front of them, so those stay put);
 *            a soft light band rolls down the cloth
 *   sky      clouds drift
 *   trophy   a light glint sweeps across the gold
 *   plants   rustle and sway from the base
 *   sun      the light shafts breathe; dust floats in them
 * The whole scene slowly pushes in toward the IPL wall logo (origin 90% 45%).
 * Framed exactly like the old static backdrop (object-cover, anchored right on
 * desktop) so the IPL logo on the wall stays in view; nothing follows the cursor.
 * Every animation is motion-safe: reduced motion gets the still image.
 */
const W = 1536
const H = 1024
const COVER_W = 'max(100vw, 150vh)' // object-cover for a 3:2 image
const L = '/assets/landing/layers'

type Box = readonly number[]
const box = ([x, y, w, h]: Box): CSSProperties => ({
  left: `${(x / W) * 100}%`,
  top: `${(y / H) * 100}%`,
  width: `${(w / W) * 100}%`,
  height: `${(h / H) * 100}%`,
})
const masked = (file: string): CSSProperties => ({
  maskImage: `url(${L}/${file})`,
  WebkitMaskImage: `url(${L}/${file})`,
  maskSize: '100% 100%',
  WebkitMaskSize: '100% 100%',
})

const BANNERS = [
  { name: 'mi', box: layout['banner-mi'], anim: 'motion-safe:animate-[scene-banner-sway_5.2s_ease-in-out_infinite]' },
  { name: 'csk', box: layout['banner-csk'], anim: 'motion-safe:animate-[scene-banner-sway_6.1s_ease-in-out_-1.7s_infinite]' },
  { name: 'rcb', box: layout['banner-rcb'], anim: 'motion-safe:animate-[scene-banner-sway_5.7s_ease-in-out_-3.1s_infinite]' },
]

export function LandingScene() {
  return (
    <div data-hero-bg className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden [--px:0.72] lg:[--px:1]">
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <filter id="scene-leaves">
          <feTurbulence type="fractalNoise" baseFrequency="0.03 0.05" numOctaves="2" seed="3">
            <animate attributeName="baseFrequency" dur="6s" values="0.03 0.05;0.036 0.058;0.03 0.05" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="scene-clouds">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="4" seed="11" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -0.75" />
        </filter>
      </svg>

      <div
        className="absolute aspect-[3/2] origin-[90%_45%] motion-safe:animate-[scene-breathe_28s_ease-in-out_infinite]"
        style={{
          width: COVER_W,
          left: `calc((100vw - ${COVER_W}) * var(--px))`,
          top: `calc((100vh - ${COVER_W} / 1.5) / 2)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${L}/bg.webp`} alt="" className="absolute inset-0 h-full w-full" />

        <div className="absolute overflow-hidden opacity-40 mix-blend-screen" style={{ ...box(layout.sky), ...masked('sky-mask.png') }}>
          <svg className="absolute inset-y-0 left-0 h-full w-[130%] motion-safe:animate-[scene-cloud-drift_70s_ease-in-out_infinite]">
            <rect width="100%" height="100%" filter="url(#scene-clouds)" />
          </svg>
        </div>

        {BANNERS.map((b) => (
          <div key={b.name} className={`absolute origin-top ${b.anim}`} style={box(b.box)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${L}/banner-${b.name}.webp`} alt="" className="absolute inset-0 h-full w-full" />
            {/* light rolling down the folds, clipped to the cloth */}
            <div
              className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(255,236,200,0.5)_50%,transparent_70%)] bg-[length:100%_300%] bg-[position:0_100%] opacity-60 mix-blend-soft-light motion-safe:animate-[scene-cloth-sheen_7s_ease-in-out_infinite]"
              style={masked(`banner-${b.name}.webp`)}
            />
          </div>
        ))}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${L}/case-lines.webp`} alt="" className="absolute" style={box(layout['case-lines'])} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${L}/wall-front.webp`} alt="" className="absolute" style={box(layout['wall-front'])} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${L}/plants.webp`}
          alt=""
          className="absolute origin-bottom motion-safe:[filter:url(#scene-leaves)] motion-safe:animate-[scene-plant-sway_6.5s_ease-in-out_infinite]"
          style={box(layout.plants)}
        />

        {/* glint: a soft diagonal highlight sweeping across the trophy's gold */}
        <div
          className="absolute mix-blend-screen motion-safe:animate-[scene-glint_5s_ease-in-out_1s_infinite] bg-[linear-gradient(105deg,transparent_38%,rgba(255,240,200,0.85)_50%,transparent_62%)] bg-[length:250%_100%] bg-[position:160%_0]"
          style={{ ...box(layout.trophy), ...masked('trophy-mask.png') }}
        />

        {/* the sunlight breathes */}
        <div
          className="absolute inset-0 bg-[#ffc98a] opacity-0 mix-blend-soft-light motion-safe:animate-[scene-sun-breathe_8s_ease-in-out_infinite]"
          style={masked('sun-mask.png')}
        />

        <Dust />
      </div>

      {/* left-edge shade so the headline stays readable */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent lg:from-black/75 lg:via-black/25 lg:to-transparent" />
    </div>
  )
}

/** Dust motes that only show where the sun-mask is bright: they float in the light shafts. */
function Dust() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let light: Uint8ClampedArray | null = null
    const MW = 768
    const MH = 512
    const img = new Image()
    img.src = `${L}/sun-mask.png`
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = MW
      c.height = MH
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0, MW, MH)
      light = g.getImageData(0, 0, MW, MH).data
    }

    // positions in 0..1 of the image box
    const motes = Array.from({ length: 140 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.004,
      vy: -0.002 - Math.random() * 0.006,
      phase: Math.random() * Math.PI * 2,
    }))

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const dpr = Math.min(window.devicePixelRatio, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      for (const m of motes) {
        m.x += m.vx * dt
        m.y += m.vy * dt
        m.phase += dt * 1.3
        if (m.y < -0.02) m.y = 1.02
        if (m.x < -0.02) m.x = 1.02
        if (m.x > 1.02) m.x = -0.02
        const px = Math.min(MW - 1, Math.max(0, Math.floor(m.x * MW)))
        const py = Math.min(MH - 1, Math.max(0, Math.floor(m.y * MH)))
        const lit = light ? light[(py * MW + px) * 4 + 3] / 255 : 0
        if (lit < 0.05) continue
        ctx.globalAlpha = lit * (0.35 + 0.35 * Math.sin(m.phase))
        ctx.fillStyle = '#fff3dc'
        ctx.beginPath()
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />
}
