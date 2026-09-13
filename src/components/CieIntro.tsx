'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Cinematic intro curtain, in four beats:
//   0.0s  a light bar sweeps across black and wipes the mark into existence
//   0.9s  impact: shockwave ring + sparks fire out of the mark
//   1.6s  the mark pushes toward camera
//   2.2s  two black panels split apart and the hero is behind them
// Plays on every load of "/".
const END = 3100

// Source art is only 128x87, so it is rendered small (and from a sharpened
// 4x PNG) — blowing it up to hero size is what made it look mushy.
const LOGO_H = 'h-24 md:h-32'

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 + 0.3
  return { x: Math.cos(a) * 260, y: Math.sin(a) * 180, d: 0.9 + (i % 5) * 0.03 }
})

export default function CieIntro() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setShow(true)
    const t = setTimeout(() => setShow(false), END)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.div key="cie-intro" className="fixed inset-0 z-50" exit={{ opacity: 0 }} transition={{ duration: 0.35, delay: 0.55 }}>
          {/* Split curtain: two solid panels that part at the end. */}
          <motion.div
            className="absolute inset-y-0 left-0 w-1/2 bg-[#05070c]"
            initial={{ x: 0 }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
          />
          <motion.div
            className="absolute inset-y-0 right-0 w-1/2 bg-[#05070c]"
            initial={{ x: 0 }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
          />

          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            {/* Warm bloom, pulled from the mark's own pink/amber gradient. */}
            <motion.div
              className="absolute h-[560px] w-[560px] rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(236,72,153,0.22) 0%, rgba(250,204,21,0.10) 42%, transparent 70%)',
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0.75], scale: [0.5, 1.15, 1] }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
            />

            {/* Beat 2 — shockwave ring. */}
            <motion.div
              className="absolute rounded-full border border-white/60"
              style={{ width: 180, height: 180 }}
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.2, 3.4, 4.2] }}
              transition={{ duration: 1.1, delay: 0.9, ease: 'easeOut', times: [0, 0.25, 1] }}
            />

            {/* Beat 2 — sparks. */}
            {SPARKS.map((s, i) => (
              <motion.span
                key={i}
                className="absolute h-[3px] w-[3px] rounded-full bg-white"
                initial={{ opacity: 0, x: 0, y: 0, scale: 1 }}
                animate={{ opacity: [0, 1, 0], x: s.x, y: s.y, scale: [1, 1.6, 0.3] }}
                transition={{ duration: 1.1, delay: s.d, ease: 'easeOut' }}
              />
            ))}

            {/* Beats 1 + 3 — the mark. Wiped in behind a moving light bar,
                then pushed toward camera before the curtain parts. */}
            <motion.div
              className="relative"
              initial={{ scale: 0.94 }}
              animate={{ scale: [0.94, 1, 1, 1.5] }}
              transition={{ duration: 3, times: [0, 0.28, 0.55, 1], ease: [0.5, 0, 0.2, 1] }}
            >
              <motion.div
                className="overflow-hidden"
                initial={{ clipPath: 'inset(0 100% 0 0)' }}
                animate={{ clipPath: 'inset(0 0% 0 0)' }}
                transition={{ duration: 0.75, ease: [0.65, 0, 0.35, 1] }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static logo asset */}
                <img
                  src="/cie-logo.png"
                  alt="MLRIT CIE"
                  className={`${LOGO_H} w-auto`}
                />
              </motion.div>

              {/* The light bar that does the wiping, then one gloss pass. */}
              <motion.div
                className="pointer-events-none absolute inset-y-[-20%] w-[10px] bg-white blur-[6px]"
                initial={{ left: '-6%', opacity: 0.9 }}
                animate={{ left: ['-6%', '104%', '104%'], opacity: [0.9, 0.9, 0] }}
                transition={{ duration: 0.95, times: [0, 0.9, 1], ease: 'easeInOut' }}
              />
            </motion.div>

            {/* Hairline that snaps open under the mark — cheap depth cue. */}
            <motion.div
              className="absolute bottom-[38%] h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: ['0px', '420px', '420px'], opacity: [0, 0.8, 0] }}
              transition={{ duration: 1.6, delay: 0.8, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
