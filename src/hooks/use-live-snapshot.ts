'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { roomChannel } from '@/lib/socket-emitter'

let client: SupabaseClient | null = null
// Lazy so tests/builds without Supabase env don't throw at import time.
const supabase = () =>
  (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!))

export type AuctionEvent = { type: string; teamId?: string; amount?: number }

/**
 * Keeps a server snapshot live: any auction event on the room channel triggers a
 * re-fetch, so the DB stays the single source of truth for all three interfaces.
 * `onEvent` fires for the transient reactions a snapshot can't express — the SOLD
 * stamp, the outbid toast — from inside the broadcast callback, not an effect.
 * ponytail: refetch-on-event, not incremental patching — one round trip per event
 * is fine at auction pace (a bid every few seconds).
 */
export function useLiveSnapshot<T>(
  roomId: string,
  initial: T,
  fetchSnapshot: (roomId: string) => Promise<T>,
  onEvent?: (event: AuctionEvent) => void
) {
  const [snapshot, setSnapshot] = useState(initial)
  const handler = useRef(onEvent)
  useEffect(() => {
    handler.current = onEvent
  })

  useEffect(() => {
    const channel = supabase()
      .channel(roomChannel(roomId))
      .on('broadcast', { event: 'auction:event' }, ({ payload }) => {
        handler.current?.(payload as AuctionEvent)
        fetchSnapshot(roomId).then(setSnapshot)
      })
      .subscribe()
    return () => {
      supabase().removeChannel(channel)
    }
  }, [roomId, fetchSnapshot])

  return { snapshot, setSnapshot }
}
