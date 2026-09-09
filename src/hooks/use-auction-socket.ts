'use client'

import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { useAuctionStore } from '@/stores/auction-store'

type AuctionEvent =
  | { type: 'BID'; teamId: string; amount: number }
  | { type: 'SOLD' }
  | { type: 'UNSOLD' }

export function useAuctionSocket(roomId: string) {
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000')
    socket.emit('room:join', roomId)

    socket.on('auction:event', (event: AuctionEvent) => {
      const { applyBid, markSold, markUnsold } = useAuctionStore.getState()
      if (event.type === 'BID') applyBid({ teamId: event.teamId, amount: event.amount })
      if (event.type === 'SOLD') markSold()
      if (event.type === 'UNSOLD') markUnsold()
    })

    return () => {
      socket.close()
    }
  }, [roomId])
}
