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
/** How long a room's channel outlives its last screen, so a remount reuses it. */
const LINGER_MS = 1000
/** After the server closes a channel (or one can't be opened), how long before trying a fresh one. */
const REOPEN_MS = 10_000

export type AuctionEvent = LiveEvent

type Listener = { onEvent: (event: AuctionEvent) => void; onStatus: (status: string) => void }
type Room = {
  listeners: Set<Listener>
  status: string | null
  channel: RealtimeChannel | null
  close?: ReturnType<typeof setTimeout>
  reopen?: ReturnType<typeof setTimeout>
}

const rooms = new Map<string, Room>()
// Channels we've let go of but realtime-js may still hold: it hands back an
// existing channel for a topic until that channel has actually closed, so a
// new one for the same room has to wait for the old one to finish leaving.
const removing = new Map<string, Promise<unknown>>()

/** One screen's handler throwing must not stop the others hearing the room. */
function notify(room: Room, call: (listener: Listener) => void) {
  for (const listener of [...room.listeners]) {
    try {
      call(listener)
    } catch (e) {
      console.error('[live] a screen failed to handle a room update', e)
    }
  }
}

function setStatus(room: Room, status: string) {
  room.status = status
  notify(room, (l) => l.onStatus(status))
}

function letGo(realtime: SupabaseClient, roomId: string, channel: RealtimeChannel) {
  const done = realtime.removeChannel(channel).catch(() => {})
  removing.set(roomId, done)
  void done.finally(() => {
    if (removing.get(roomId) === done) removing.delete(roomId)
  })
}

function openChannel(realtime: SupabaseClient, roomId: string, room: Room) {
  const topic = roomChannel(roomId)
  const reopenLater = () => {
    clearTimeout(room.reopen)
    room.reopen = setTimeout(() => openChannel(realtime, roomId, room), REOPEN_MS)
  }
  const start = () => {
    if (rooms.get(roomId) !== room) return
    // Still there after waiting (its unsubscribe timed out): realtime-js would
    // hand this dead channel straight back. Screens poll; try again later.
    if (realtime.getChannels().some((c) => c.topic === `realtime:${topic}`)) {
      setStatus(room, 'CHANNEL_ERROR')
      return reopenLater()
    }
    const channel = realtime
      .channel(topic)
      .on('broadcast', { event: 'auction:event' }, ({ payload }) => {
        if (room.channel === channel) notify(room, (l) => l.onEvent(payload as AuctionEvent))
      })
      .subscribe((status) => {
        // Late statuses from a channel this room already replaced or let go of.
        if (rooms.get(roomId) !== room || room.channel !== channel) return
        setStatus(room, status)
        // A server-side close is final for this channel object (realtime-js
        // only retries errors and timeouts), so rejoin later with a new one.
        if (status === 'CLOSED') {
          room.channel = null
          letGo(realtime, roomId, channel)
          reopenLater()
        }
      })
    room.channel = channel
  }
  const pending = removing.get(roomId)
  if (pending) void pending.then(start)
  else start()
}

/**
 * One channel per room, shared by every screen on the page, so a remount (React
 * dev mounts twice) reuses the live channel instead of building a new one on
 * top of one that's still closing. It closes a moment after the last screen
 * leaves.
 */
function joinRoom(realtime: SupabaseClient, roomId: string, listener: Listener): () => void {
  let room = rooms.get(roomId)
  const isNew = !room
  room ??= { listeners: new Set(), status: null, channel: null }
  clearTimeout(room.close)
  room.listeners.add(listener)
  if (isNew) {
    rooms.set(roomId, room)
    openChannel(realtime, roomId, room)
  } else if (room.status) {
    // A screen joining an already-open room still needs to know where it stands.
    try {
      listener.onStatus(room.status)
    } catch (e) {
      console.error('[live] a screen failed to handle a room update', e)
    }
  }

  const joined = room
  return () => {
    joined.listeners.delete(listener)
    if (joined.listeners.size > 0) return
    joined.close = setTimeout(() => {
      if (joined.listeners.size > 0) return
      rooms.delete(roomId)
      clearTimeout(joined.reopen)
      if (joined.channel) letGo(realtime, roomId, joined.channel)
      joined.channel = null
    }, LINGER_MS)
  }
}

type Options<T> = {
  /** Transient reactions a snapshot can't express (SOLD stamp, outbid toast). */
  onEvent?: (event: AuctionEvent) => void
  /** The next snapshot from a broadcast, or null to refetch instead. */
  applyEvent?: (prev: T, event: AuctionEvent) => T | null
  /**
   * How new a snapshot is. With it, a refetch that comes back older than what
   * a broadcast already put on screen is read again instead of dropped, so
   * what it carried (purses, the ticker) isn't lost behind a bid that only
   * moved the lot.
   */
  versionOf?: (snapshot: T) => number
}

/**
 * Keeps a server snapshot live. Each broadcast carries the new state, and
 * `applyEvent` turns it into the next snapshot with no round trip.
 *
 * Broadcasts are fire-and-forget: anything sent while this screen wasn't
 * listening (before the first subscribe, a dropped socket, a phone asleep in a
 * pocket) is gone. So it also refetches whenever the channel (re)joins, the tab
 * comes back into view, or the network returns, and polls while live updates
 * are down.
 */
export function useLiveSnapshot<T>(
  roomId: string,
  initial: T,
  fetchSnapshot: (roomId: string) => Promise<T>,
  options: Options<T> = {}
) {
  const [snapshot, setRawSnapshot] = useState(initial)
  const opts = useRef(options)
  useEffect(() => {
    opts.current = options
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
  // snapshot the caller sets (an action's result) supersedes every refetch
  // already in flight.
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
    const refresh = (retried = false) => {
      if (disposed) return
      const request = ++latest.current
      fetchSnapshot(roomId)
        .then((next) => {
          if (disposed || request !== latest.current) return
          const versionOf = opts.current.versionOf
          if (versionOf && versionOf(next) < versionOf(current.current)) {
            // A broadcast landed while this was in flight; read once more.
            if (!retried) refresh(true)
            return
          }
          commit(next)
        })
        .catch(() => {})
    }

    // Polling is the fallback whenever live updates aren't flowing — env
    // missing, a wrong project URL/key, a blocked socket — so a screen never
    // freezes on an old lot. It stops again as soon as the channel joins.
    // Warnings, not errors: the screen keeps working, and Next's dev overlay
    // turns console.error into a red error box. Logged once per switch.
    let poll: ReturnType<typeof setInterval> | undefined
    const startPolling = (why: string) => {
      if (poll) return
      console.warn(`[live] ${why} — polling every ${POLL_MS / 1000}s until live updates work`)
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
            const { onEvent, applyEvent, versionOf } = opts.current
            onEvent?.(event)
            const next = applyEvent?.(current.current, event)
            if (next == null) return refresh()
            if (next === current.current) return // stale or our own echo: nothing new
            // Without versions, a newer broadcast is the only way to know an
            // in-flight refetch is stale, so it supersedes it.
            if (!versionOf) latest.current++
            commit(next)
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
    const onOnline = () => refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      stopPolling()
      leave?.()
    }
  }, [roomId, fetchSnapshot, commit])

  return { snapshot, setSnapshot }
}
