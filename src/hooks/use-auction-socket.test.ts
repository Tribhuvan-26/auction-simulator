import { renderHook } from '@testing-library/react'
import { vi } from 'vitest'

const mockOn = vi.fn()
const mockEmit = vi.fn()
const mockSocket = { on: mockOn, emit: mockEmit, close: vi.fn() }

vi.mock('socket.io-client', () => ({ io: () => mockSocket }))

const applyBid = vi.fn()
const markSold = vi.fn()
const markUnsold = vi.fn()

vi.mock('@/stores/auction-store', () => ({
  useAuctionStore: { getState: () => ({ applyBid, markSold, markUnsold }) },
}))

import { useAuctionSocket } from './use-auction-socket'

describe('useAuctionSocket', () => {
  beforeEach(() => {
    mockOn.mockClear()
    mockEmit.mockClear()
    applyBid.mockClear()
  })

  it('joins the given room on mount', () => {
    renderHook(() => useAuctionSocket('room-1'))
    expect(mockEmit).toHaveBeenCalledWith('room:join', 'room-1')
  })

  it('dispatches a BID event to applyBid', () => {
    renderHook(() => useAuctionSocket('room-1'))
    const handler = mockOn.mock.calls.find(([event]) => event === 'auction:event')![1]
    handler({ type: 'BID', teamId: 'team-1', amount: 200 })
    expect(applyBid).toHaveBeenCalledWith({ teamId: 'team-1', amount: 200 })
  })

  it('dispatches a SOLD event to markSold', () => {
    renderHook(() => useAuctionSocket('room-1'))
    const handler = mockOn.mock.calls.find(([event]) => event === 'auction:event')![1]
    handler({ type: 'SOLD' })
    expect(markSold).toHaveBeenCalled()
  })
})
