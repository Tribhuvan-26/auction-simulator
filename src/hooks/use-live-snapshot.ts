'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { roomChannel } from '@/lib/socket-emitter'
import type { LiveEvent } from '@/lib/live-events'

let client: SupabaseClient | null = null
// Lazy so tests/builds without Supabase env don't throw at import time. Null
// when the env is missing: createClient would throw inside the effect and take
// the whole console down, so the hook falls back to polling instead.
const supabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return (client ??= createClient(url, key))
}

/** Without Realtime, how often a screen re-reads the room. */
const POLL_MS = 3000

export type AuctionEvent = LiveEvent

/**
 * Keeps a server snapshot live. Each broadcast carries the new state, and
 * `applyEvent` turns it into the next snapshot with no round trip; when it
 * returns null (nothing usable in the message) the screen refetches instead.
 * `onEvent` fires for the transient reactions a snapshot can't express — the
 * SOLD stamp, the outbid toast — from inside the broadcast callback.
 *
 * Broadcasts are fire-and-forget: anything sent while this screen wasn't
 * listening (before the first subscribe, a dropped socket, a phone asleep in a
 * pocket) is gone. So it also refetches whenever the channel (re)joins, the tab
 * comes back into view, or the network returns.
 */
export function useLiveSnapshot<T>(
  roomId: string,
  initial: T,
  fetchSnapshot: (roomId: string) => Promise<T>,
  onEvent?: (event: AuctionEvent) => void,
  applyEvent?: (prev: T, event: AuctionEvent) => T | null
) {
  const [snapshot, setRawSnapshot] = useState(initial)
  const handler = useRef(onEvent)
  const apply = useRef(applyEvent)
  useEffect(() => {
    handler.current = onEvent
    apply.current = applyEvent
  })

  // The broadcast callback lives outside render, so it reads the current
  // snapshot from here rather than a stale closure.
  const current = useRef(initial)
  const commit = useCallback((next: T) => {
    current.current = next
    setRawSnapshot(next)
  }, [])

  // Two quick refetches can land in either order; only the newest request may
  // write, so an older response never rolls the board back to a stale bid. A
  // snapshot set any other way (an action's result, a broadcast) counts as
  // newer than every refetch already in flight.
  const latest = useRef(0)
  const setSnapshot = useCallback(
    (next: T | ((prev: T) => T)) => {
      latest.current++
      commit(typeof next === 'function' ? (next as (prev: T) => T)(current.current) : next)
    },
    [commit]
  )

  useEffect(() => {
    // A failed refetch keeps the last good snapshot.
    const refresh = () => {
      const request = ++latest.current
      fetchSnapshot(roomId)
        .then((next) => {
          if (request === latest.current) commit(next)
        })
        .catch(() => {})
    }

    // Polling is the fallback whenever live updates aren't flowing — env
    // missing, a wrong project URL/key, a blocked socket — so a screen never
    // freezes on an old lot. It stops again as soon as the channel joins.
    let poll: ReturnType<typeof setInterval> | undefined
    const startPolling = () => {
      poll ??= setInterval(refresh, POLL_MS)
    }
    const stopPolling = () => {
      clearInterval(poll)
      poll = undefined
    }

    const realtime = supabase()
    if (!realtime) {
      console.error('[live] Supabase env not set — polling every 3s instead of live updates')
      startPolling()
    }
    const channel = realtime
      ?.channel(roomChannel(roomId))
      .on('broadcast', { event: 'auction:event' }, ({ payload }) => {
        const event = payload as AuctionEvent
        handler.current?.(event)
        const next = apply.current?.(current.current, event)
        if (!next) return refresh()
        latest.current++
        if (next !== current.current) commit(next)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          stopPolling()
          refresh()
        } else {
          console.error(`[live] realtime channel ${status} — polling every 3s until it reconnects`)
          startPolling()
        }
      })

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
      stopPolling()
      if (channel) realtime?.removeChannel(channel)
    }
  }, [roomId, fetchSnapshot, commit])

  return { snapshot, setSnapshot }
}
