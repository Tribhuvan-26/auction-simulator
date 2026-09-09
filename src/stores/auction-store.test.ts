import { useAuctionStore } from './auction-store'
import type { RoomState } from './auction-store'

const baseRoom: RoomState = {
  id: 'room-1',
  phase: 'LIVE',
  currentLot: {
    id: 'lot-1',
    playerId: 'player-1',
    currentBid: 100,
    currentBiddingTeamId: null,
    status: 'BIDDING',
    bidHistory: [],
  },
  teams: [{ id: 'team-1', name: 'Mumbai Monarchs', purseRemaining: 10000 }],
}

describe('auction-store', () => {
  beforeEach(() => {
    useAuctionStore.getState().setRoom(baseRoom)
  })

  it('applies a bid, updating currentBid, bidder, and bid history', () => {
    useAuctionStore.getState().applyBid({ teamId: 'team-1', amount: 150 })
    const { currentLot } = useAuctionStore.getState().room!
    expect(currentLot!.currentBid).toBe(150)
    expect(currentLot!.currentBiddingTeamId).toBe('team-1')
    expect(currentLot!.bidHistory).toHaveLength(1)
  })

  it('marks the lot sold', () => {
    useAuctionStore.getState().markSold()
    expect(useAuctionStore.getState().room!.currentLot!.status).toBe('SOLD')
  })

  it('marks the lot unsold', () => {
    useAuctionStore.getState().markUnsold()
    expect(useAuctionStore.getState().room!.currentLot!.status).toBe('UNSOLD')
  })

  it('undoes the last bid by popping bid history and recomputing current bid', () => {
    useAuctionStore.getState().applyBid({ teamId: 'team-1', amount: 150 })
    useAuctionStore.getState().applyBid({ teamId: 'team-1', amount: 200 })
    useAuctionStore.getState().undoLastBid()
    const { currentLot } = useAuctionStore.getState().room!
    expect(currentLot!.currentBid).toBe(150)
    expect(currentLot!.bidHistory).toHaveLength(1)
  })

  it('undo on an empty bid history leaves currentBid unchanged without erroring', () => {
    useAuctionStore.getState().undoLastBid()
    const { currentLot } = useAuctionStore.getState().room!
    expect(currentLot!.currentBid).toBe(100)
    expect(currentLot!.bidHistory).toHaveLength(0)
  })
})
