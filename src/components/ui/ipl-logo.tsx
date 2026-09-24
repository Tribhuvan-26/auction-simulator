import React from 'react'
import { cn } from '@/lib/cn'

/**
 * Official IPL Brand Logo & Wordmark
 * Uses the authentic IPL cricketer SVG & PNG from the Figma design
 */
export function IplLogo({
  className,
  size = 'md',
  showText = true,
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
}) {
  const iconSizes = {
    sm: 'h-7 w-auto',
    md: 'h-9 w-auto',
    lg: 'h-13 w-auto',
    xl: 'h-16 w-auto',
  }

  return (
    <div className={cn('flex items-center gap-2 select-none group', className)}>
      {/* Authentic Cricketer Silhouette SVG & PNG */}
      <picture className="shrink-0 flex items-center">
        <source srcSet="/assets/brand/ipl-cricketer.svg" type="image/svg+xml" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/brand/ipl-cricketer.png"
          alt="IPL Cricketer"
          className={cn(iconSizes[size], 'object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.45)]')}
        />
      </picture>

      {/* Official IPL Wordmark */}
      <div className="flex flex-col justify-center leading-none">
        <span className="font-teko text-2xl sm:text-3xl md:text-4xl font-bold tracking-wider uppercase text-white leading-none drop-shadow-sm">
          IPL
        </span>
        {showText && (
          <span className="font-mono text-[7.5px] sm:text-[8.5px] tracking-[0.28em] uppercase text-brand-yellow font-black mt-0.5 leading-none">
            AUCTION
          </span>
        )}
      </div>
    </div>
  )
}
