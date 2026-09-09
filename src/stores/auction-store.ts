import { create } from 'zustand'

export type TeamState = { id: string; name: string; purseRemaining: number }
export type LotState = {
  id: string
  playerId: string
  currentBid: number
  currentBiddingTeamId: string | null
  status: string
  bidHistory: { teamId: string; amount: number; timestamp: string }[]
}
export type RoomState = {
  id: string
  phase: string
  currentLot: LotState | null
  teams: TeamState[]
}

type AuctionStore = {
  room: RoomState | null
  setRoom: (room: RoomState) => void
  applyBid: (bid: { teamId: string; amount: number }) => void
  markSold: () => void
  markUnsold: () => void
  undoLastBid: () => void
}

export const useAuctionStore = create<AuctionStore>((set) => ({
  room: null,

  setRoom: (room) => set({ room }),

  applyBid: ({ teamId, amount }) =>
    set((state) => {
      if (!state.room?.currentLot) return state
      const entry = { teamId, amount, timestamp: new Date().toISOString() }
      return {
        room: {
          ...state.room,
          currentLot: {
            ...state.room.currentLot,
            currentBid: amount,
            currentBiddingTeamId: teamId,
            bidHistory: [...state.room.currentLot.bidHistory, entry],
          },
        },
      }
    }),

  markSold: () =>
    set((state) => {
      if (!state.room?.currentLot) return state
      return { room: { ...state.room, currentLot: { ...state.room.currentLot, status: 'SOLD' } } }
    }),

  markUnsold: () =>
    set((state) => {
      if (!state.room?.currentLot) return state
      return { room: { ...state.room, currentLot: { ...state.room.currentLot, status: 'UNSOLD' } } }
    }),

  undoLastBid: () =>
    set((state) => {
      const lot = state.room?.currentLot
      if (!lot) return state
      const history = lot.bidHistory.slice(0, -1)
      const previous = history[history.length - 1]
      return {
        room: {
          ...state.room!,
          currentLot: {
            ...lot,
            bidHistory: history,
            currentBid: previous ? previous.amount : lot.currentBid,
            currentBiddingTeamId: previous ? previous.teamId : lot.currentBiddingTeamId,
          },
        },
      }
    }),
}))
