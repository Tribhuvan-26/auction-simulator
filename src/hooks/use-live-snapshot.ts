'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
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

type Listener = { onEvent: (event: AuctionEvent) => void; onStatus: (status: string) => void }
type Room = { channel: RealtimeChannel; listeners: Set<Listener>; status: string | null; close?: ReturnType<typeof setTimeout> }

/** How long a room's channel outlives its last screen, so a remount reuses it. */
const LINGER_MS = 1000

const rooms = new Map<string, Room>()

/**
 * One channel per room, shared by every screen on the page. realtime-js hands
 * back an existing channel for the same topic even while it's still closing
 * (removeChannel is async), so tearing down and re-creating on every effect
 * run — React dev mounts twice — leaves the new screen on a dead channel.
 * Instead the channel stays up while anyone listens and closes a moment after
 * the last one leaves.
 */
function joinRoom(realtime: SupabaseClient, roomId: string, listener: Listener): () => void {
  let room = rooms.get(roomId)
  if (!room) {
    const listeners = new Set<Listener>()
    const entry: Room = {
      listeners,
      status: null,
      channel: realtime
        .channel(roomChannel(roomId))
        .on('broadcast', { event: 'auction:event' }, ({ payload }) => {
          for (const l of listeners) l.onEvent(payload as AuctionEvent)
        })
        .subscribe((status) => {
          // Status arrives asynchronously, after `entry` exists.
          entry.status = status
          for (const l of listeners) l.onStatus(status)
        }),
    }
    rooms.set(roomId, entry)
    room = entry
  }
  clearTimeout(room.close)
  room.listeners.add(listener)
  // A screen joining an already-open channel still needs to know where it stands.
  if (room.status) listener.onStatus(room.status)

  const joined = room
  return () => {
    joined.listeners.delete(listener)
    if (joined.listeners.size > 0) return
    joined.close = setTimeout(() => {
      if (joined.listeners.size > 0 || rooms.get(roomId) !== joined) return
      rooms.delete(roomId)
      void realtime.removeChannel(joined.channel)
    }, LINGER_MS)
  }
}

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
    // Every callback below can outlive this effect (a late refetch, a status
    // from the shared channel), so each one checks this first: once the room
    // changes or the screen unmounts, this run touches nothing.
    let disposed = false

    // A failed refetch keeps the last good snapshot.
    const refresh = () => {
      if (disposed) return
      const request = ++latest.current
      fetchSnapshot(roomId)
        .then((next) => {
          if (!disposed && request === latest.current) commit(next)
        })
        .catch(() => {})
    }

    // Polling is the fallback whenever live updates aren't flowing — env
    // missing, a wrong project URL/key, a blocked socket — so a screen never
    // freezes on an old lot. It stops again as soon as the channel joins.
    // Warnings, not errors: the screen keeps working, and Next's dev overlay
    // turns console.error into a red error box. Logged once per switch, not on
    // every reconnect attempt.
    let poll: ReturnType<typeof setInterval> | undefined
    const startPolling = (why: string) => {
      if (poll) return
      console.warn(`[live] ${why} — polling every 3s until live updates work`)
      poll = setInterval(refresh, POLL_MS)
    }
    const stopPolling = () => {
      clearInterval(poll)
      poll = undefined
    }

    const realtime = supabase()
    const leave = realtime
      ? joinRoom(realtime, roomId, {
          onEvent: (event) => {
            if (disposed) return
            handler.current?.(event)
            const next = apply.current?.(current.current, event)
            if (!next) return refresh()
            latest.current++
            if (next !== current.current) commit(next)
          },
          onStatus: (status) => {
            if (disposed) return
            if (status === 'SUBSCRIBED') {
              stopPolling()
              refresh()
            } else {
              startPolling(`realtime channel ${status}`)
            }
          },
        })
      : (startPolling('Supabase env not set'), undefined)

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
      stopPolling()
      leave?.()
    }
  }, [roomId, fetchSnapshot, commit])

  return { snapshot, setSnapshot }
}
