'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

/**
 * Slides in with a slight overshoot on mount, and out on unmount — call this
 * from inside an <AnimatePresence> keyed by team id so the outgoing chip
 * actually animates away instead of just disappearing.
 */
export function TeamChip({
  name,
  shortCode,
  colorAccent,
  className,
}: {
  name: string
  shortCode: string
  colorAccent: string
  className?: string
}) {
  return (
    <motion.div
      initial={{ x: 48, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -32, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className={cn(
        'inline-flex items-center gap-2 border-[3px] border-brand-charcoal px-3 py-2 text-brand-white',
        className
      )}
      style={{ backgroundColor: colorAccent }}
    >
      <span className="font-heading text-xs font-bold opacity-80">{shortCode}</span>
      <span className="font-heading font-bold">{name}</span>
    </motion.div>
  )
}
