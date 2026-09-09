'use client'

import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

export type AuctionEvent = { type: string; teamId?: string; amount?: number }

/**
 * Keeps a server snapshot live: any auction event on the room channel triggers a
 * re-fetch, so the DB stays the single source of truth for all three interfaces.
 * `onEvent` fires for the transient reactions a snapshot can't express — the SOLD
 * stamp, the outbid toast — from inside the socket callback, not an effect.
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
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000')
    socket.emit('room:join', roomId)
    socket.on('auction:event', (event: AuctionEvent) => {
      handler.current?.(event)
      fetchSnapshot(roomId).then(setSnapshot)
    })
    return () => {
      socket.close()
    }
  }, [roomId, fetchSnapshot])

  return { snapshot, setSnapshot }
}
