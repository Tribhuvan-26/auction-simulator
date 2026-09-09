'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrutalCard } from '@/components/ui/brutal-card'
import { BrutalButton } from '@/components/ui/brutal-button'
import { Lock } from 'lucide-react'
import { unlockTeam } from './actions'

export function TeamGate({
  roomId,
  teamId,
  teamName,
  colorAccent,
  initialPin = '',
}: {
  roomId: string
  teamId: string
  teamName: string
  colorAccent: string
  initialPin?: string
}) {
  const router = useRouter()
  const [pin, setPin] = useState(initialPin)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const message = await unlockTeam(roomId, teamId, pin)
    setPending(false)
    if (message) {
      setError(message)
      return
    }
    // The cookie is set; re-render the page as an unlocked seat.
    router.refresh()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-charcoal p-6">
      <BrutalCard variant="active" className="w-full max-w-sm">
        <div
          className="-mx-4 -mt-4 mb-4 flex items-center gap-2 rounded-t-2xl px-4 py-3 text-brand-white"
          style={{ background: colorAccent }}
        >
          <Lock size={18} aria-hidden />
          <h1 className="font-heading text-xl font-bold">{teamName}</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="pin" className="font-heading text-sm font-bold">
            Enter your table&apos;s 4-digit PIN
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
            className="w-full border-[3px] border-brand-charcoal px-3 py-2 text-center font-heading text-3xl tracking-[0.4em] tabular-nums"
          />
          <BrutalButton type="submit" variant="blue" disabled={pin.length !== 4 || pending}>
            {pending ? 'Checking…' : 'Take the seat'}
          </BrutalButton>
          {error && (
            <p role="alert" className="text-sm font-bold text-brand-pink">
              {error}
            </p>
          )}
          <p className="text-xs">The auctioneer has the PINs — ask at the desk.</p>
        </form>
      </BrutalCard>
    </main>
  )
}
