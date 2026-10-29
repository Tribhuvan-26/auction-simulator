'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TeamCrest } from '@/components/ui/team-crest'
import { donorUrl, swapKit, teamOfPhoto } from '@/lib/kit-swap'

// Contain, not cover: the photos are square and the frames aren't, and cover
// cropped heads and shoulders off. The whole picture always shows.
const IMG_CLASS = 'h-full w-full object-contain object-center filter contrast-[1.05]'
const SWAP_DELAY = 1700 // after the bat-swing celebration
const SWAP_MS = 1400
const EASE = 'cubic-bezier(.65,0,.35,1)'

export type SoldTo = { shortCode: string; name: string; colorAccent: string; logoUrl: string | null }

type Anim = { key: string; swapped: HTMLCanvasElement | null; revealed: boolean; done: boolean }
const fresh = (key: string): Anim => ({ key, swapped: null, revealed: false, done: false })

/**
 * The lot's portrait. Once the lot is SOLD, a team-coloured scan line sweeps
 * across it left to right, leaving the player in the buying franchise's real
 * jersey; the portrait then pops and the franchise crest drops in.
 */
export function LotPhoto({
  src, alt, soldTo, className = 'relative h-full w-full',
}: { src: string; alt: string; soldTo: SoldTo | null; className?: string }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const code = soldTo?.shortCode
  // The animation belongs to one photo + buyer. Keying it means a new lot (or
  // an undone sale) starts clean in the same render, instead of showing the
  // last lot's kit canvas or a hidden <img> until an effect resets it.
  const key = `${src}|${code ?? ''}`
  const [anim, setAnim] = useState<Anim>(() => fresh(key))
  // Reset on every change of photo or buyer, during render (React's pattern
  // for state that follows a prop). Only resetting inside the effect missed
  // an undone sale: the effect bails out early, so re-selling to the same
  // team found the old finished state and skipped the sweep.
  if (anim.key !== key) setAnim(fresh(key))
  const { swapped, revealed, done } = anim.key === key ? anim : fresh(key)

  useEffect(() => {
    const donor = code ? donorUrl(code) : null
    if (!donor || teamOfPhoto(src) === code?.toLowerCase() || !imgRef.current) return
    const img = imgRef.current
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const update = (patch: Partial<Anim>) =>
      setAnim((a) => ({ ...(a.key === key ? a : fresh(key)), ...patch }))
    timers.push(setTimeout(() => {
      const donorImg = new Image()
      donorImg.onload = () => {
        if (cancelled || !img.complete) return
        update({ swapped: swapKit(img, donorImg) })
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (cancelled) return
          update({ revealed: true })
          timers.push(setTimeout(() => !cancelled && update({ done: true }), SWAP_MS))
        }))
      }
      donorImg.src = donor
    }, SWAP_DELAY))
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [src, code, key])

  const color = soldTo?.colorAccent ?? '#fff'

  return (
    <motion.div className={className} animate={done ? { scale: [1, 1.05, 1] } : { scale: 1 }} transition={{ duration: 0.5 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt={alt} className={IMG_CLASS} style={{ opacity: done ? 0 : 1 }} />
      {swapped && (
        <>
          <canvas
            ref={(c) => {
              if (c && !c.dataset.drawn) {
                c.dataset.drawn = '1'
                c.width = swapped.width
                c.height = swapped.height
                c.getContext('2d')!.drawImage(swapped, 0, 0)
              }
            }}
            aria-hidden="true"
            className={`absolute inset-0 ${IMG_CLASS}`}
            style={{
              clipPath: revealed ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
              transition: `clip-path ${SWAP_MS}ms ${EASE}`,
            }}
          />
          {/* Scan line riding the reveal edge, with a glow trail */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-1"
            style={{
              left: revealed ? '100%' : '0%',
              opacity: done ? 0 : 1,
              background: color,
              boxShadow: `0 0 28px 14px ${color}, 0 0 80px 40px ${color}55`,
              transition: `left ${SWAP_MS}ms ${EASE}, opacity 300ms`,
            }}
          />
          {/* White flash as the new kit lands */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: done ? [0.55, 0] : 0 }}
            transition={{ duration: 0.45 }}
          />
          <AnimatePresence>
            {done && soldTo && (
              <motion.div
                className="absolute bottom-0 inset-x-0 flex items-center gap-2 bg-black/75 px-2 py-1.5"
                style={{ borderTop: `3px solid ${color}` }}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
                >
                  <TeamCrest {...soldTo} mark className="h-8 w-8" />
                </motion.div>
                <span className="font-condensed text-lg font-black uppercase tracking-wide text-white truncate">
                  SOLD TO {soldTo.shortCode}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}
