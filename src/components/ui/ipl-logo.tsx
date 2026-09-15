import React from 'react'
import { cn } from '@/lib/cn'

/**
 * Official IPL Stylized Batsman Emblem & Brand Wordmark
 * As featured in the top-left corner of all visual references.
 */
export function IplLogo({
  className,
  size = 'md',
  showText = true,
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}) {
  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  }

  return (
    <div className={cn('flex items-center gap-2 select-none', className)}>
      {/* Iconic IPL Batsman Silhouette Icon */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(iconSizes[size], 'shrink-0')}
        aria-hidden="true"
      >
        {/* Stylized Batsman silhouette stroke */}
        <circle cx="58" cy="22" r="7" fill="currentColor" />
        <path
          d="M32 82C32 82 39 74 44 64C47 57 49 48 46 41C44 36 38 33 33 36C28 39 25 45 25 50"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M48 42C52 38 62 36 67 43C71 49 68 59 62 67C56 75 49 84 49 84"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Raised Bat */}
        <path
          d="M62 36L78 12C80 9 84 9 86 11C88 13 88 17 85 19L68 43"
          fill="currentColor"
        />
        {/* Dynamic motion swoosh */}
        <path
          d="M18 48C18 30 32 15 50 15C54 15 58 16 62 17"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="1 6"
        />
      </svg>

      {showText && (
        <span
          className={cn(
            'font-display font-black tracking-tighter uppercase text-white',
            textSizes[size]
          )}
        >
          IPL
        </span>
      )}
    </div>
  )
}
