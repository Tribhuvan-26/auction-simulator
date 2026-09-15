import React from 'react'
import { GlobalHeader } from '@/components/ui/global-header'
import { GlobalFooter } from '@/components/ui/global-footer'
import { cn } from '@/lib/cn'

export interface GlobalShellProps {
  children: React.ReactNode
  roomId?: string
  roomName?: string
  teamName?: string
  phase?: string
  round?: number
  telemetryText?: string
  className?: string
  contentClassName?: string
  hideFooter?: boolean
  hideHeader?: boolean
}

/**
 * Global Architectural Shell Container
 * Enforces unified background, concrete atmosphere, typography, navigation, and telemetry.
 */
export function GlobalShell({
  children,
  roomId,
  roomName,
  teamName,
  phase = 'LIVE',
  round,
  telemetryText,
  className,
  contentClassName,
  hideFooter = false,
  hideHeader = false,
}: GlobalShellProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-screen w-full flex-col bg-[#121212] bg-concrete text-white overflow-x-hidden selection:bg-brand-blue selection:text-white',
        className
      )}
    >
      {/* Top Global Navigation Bar */}
      {!hideHeader && (
        <GlobalHeader
          roomId={roomId}
          roomName={roomName}
          teamName={teamName}
          phase={phase}
          round={round}
        />
      )}

      {/* Main Content Area */}
      <main className={cn('relative z-10 flex flex-1 flex-col', contentClassName)}>
        {children}
      </main>

      {/* Bottom Telemetry Footer */}
      {!hideFooter && (
        <GlobalFooter telemetryText={telemetryText} />
      )}
    </div>
  )
}
