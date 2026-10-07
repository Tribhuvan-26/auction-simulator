'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrutalCard } from '@/components/ui/brutal-card'
import { BrutalButton } from '@/components/ui/brutal-button'
import { Lock, ShieldCheck } from 'lucide-react'

/**
 * Architectural PIN Gate: secure dark control-room access point.
 */
export function PinGate({
  title,
  accent,
  hint,
  initialPin = '',
  unlock,
}: {
  title: string
  accent: string
  hint: string
  initialPin?: string
  unlock: (pin: string) => Promise<string | null>
}) {
  const router = useRouter()
  const [pin, setPin] = useState(initialPin)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const message = await unlock(pin)
      if (message) {
        setError(message)
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach the server. Check the connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#0d0d0d] p-6 text-white overflow-hidden">
      {/* Brutalist Architecture Environmental Backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/landing/ipl-auction-environment.jpg"
        alt="IPL Architecture"
        className="fixed inset-0 z-0 h-full w-full object-cover object-[center_right] pointer-events-none select-none opacity-30"
      />
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-t from-black/80 via-black/40 to-black/70" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Technical header badge */}
        <div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">
          <span className="flex items-center gap-1.5">
            <Lock size={12} className="text-brand-yellow" /> SECURE CONSOLE ACCESS
          </span>
          <span>IPL AUCTION 2026</span>
        </div>

        <BrutalCard variant="active" className="w-full border-white/15 bg-[#1A1A1A] p-0 shadow-brutal">
          <div
            className="flex items-center justify-between px-5 py-3.5 text-white"
            style={{ background: accent }}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} aria-hidden />
              <h1 className="font-heading text-lg font-black tracking-wide uppercase">{title}</h1>
            </div>
            <span className="font-mono text-[10px] tracking-widest uppercase opacity-80">AUTHENTICATE</span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
            <div>
              <label htmlFor="pin" className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
                Enter the 4-digit PIN
              </label>
              <input
                id="pin"
                name="pin"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="mt-2 w-full border-2 border-white/20 bg-[#121212] px-3 py-2.5 text-center font-heading text-3xl tracking-[0.45em] tabular-nums text-brand-yellow focus:border-brand-blue focus:outline-none"
              />
            </div>

            <BrutalButton
              type="submit"
              variant="blue"
              disabled={pin.length !== 4 || pending}
              className="w-full py-2.5 text-sm font-bold tracking-widest"
            >
              {pending ? 'VERIFYING CREDENTIALS…' : 'UNLOCK'}
            </BrutalButton>

            {error && (
              <p role="alert" className="border border-brand-pink/40 bg-brand-pink/10 px-3 py-2 text-center font-mono text-xs font-bold text-brand-pink">
                {error}
              </p>
            )}

            <p className="font-mono text-[10px] text-white/40 tracking-wider text-center">{hint}</p>
          </form>
        </BrutalCard>
      </div>
    </main>
  )
}

