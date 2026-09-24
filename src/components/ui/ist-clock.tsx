'use client'

import { useEffect, useState } from 'react'

/**
 * Real-time Indian Standard Time (IST) digital clock
 * Formatted as: HH:MM:SS IST
 */
export function IstClock({ className }: { className?: string }) {
  const [timeStr, setTimeStr] = useState<string>('05:42:17 IST')

  useEffect(() => {
    function updateClock() {
      const now = new Date()
      // Format into Indian Standard Time (Asia/Kolkata)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }
      try {
        const istTime = new Intl.DateTimeFormat('en-GB', options).format(now)
        setTimeStr(`${istTime} IST`)
      } catch {
        // Fallback
        setTimeStr(`${now.toLocaleTimeString()} IST`)
      }
    }

    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className={className}>
      {timeStr}
    </span>
  )
}
