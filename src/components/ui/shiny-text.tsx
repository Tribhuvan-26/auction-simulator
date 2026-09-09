import { cn } from '@/lib/cn'

/**
 * Light sweeping across a label. Used on the SOLD button so the eye finds it
 * during a countdown.
 *
 * The sweep is a second copy of the text laid over the first, clipped to the
 * glyphs, carrying a transparent→white→transparent gradient. Painting the
 * label itself with the gradient (color: transparent + background-clip) makes
 * it vanish wherever the gradient is transparent — the label has to stay solid
 * and take the highlight on top.
 */
export function ShinyText({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn('shiny-text', className)}>
      {children}
      <span aria-hidden className="shiny-text__sweep">
        {children}
      </span>
    </span>
  )
}
