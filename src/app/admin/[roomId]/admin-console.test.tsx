import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { AdminConsole } from './admin-console'
import type { AdminSnapshot } from './actions'

vi.mock('@/hooks/use-auction-socket', () => ({ useAuctionSocket: vi.fn() }))
vi.mock('@/stores/auction-store', () => ({
  useAuctionStore: Object.assign(
    vi.fn(() => ({ room: null })),
    { getState: () => ({ setRoom: vi.fn() }) }
  ),
}))
vi.mock('./actions', () => ({
  setPhase: vi.fn(async () => baseSnapshot),
  markSold: vi.fn(async () => baseSnapshot),
  markUnsold: vi.fn(async () => baseSnapshot),
  undoLastBid: vi.fn(async () => baseSnapshot),
  controlTimer: vi.fn(async () => baseSnapshot),
  placeBid: vi.fn(async () => baseSnapshot),
  advanceToNextLot: vi.fn(async () => baseSnapshot),
}))

const baseSnapshot: AdminSnapshot = {
  room: { id: 'room-1', phase: 'LIVE', round: 1 },
  currentLot: null,
  teams: [],
  queue: [],
}

const liveSnapshot: AdminSnapshot = {
  ...baseSnapshot,
  currentLot: {
    id: 'lot-1', status: 'BIDDING', currentBid: 20, currentBiddingTeamId: 'team-1', timerSeconds: 30, bidHistory: [],
    player: { id: 'p1', name: 'X', role: 'BATTER', basePrice: 20, photoUrl: null, nationality: 'India', matches: 1, runs: null, wickets: null, average: null, strikeRate: null, economy: null },
  },
}

describe('AdminConsole', () => {
  it('renders the phase pill showing the current phase', () => {
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('shows a confirm modal before ending the auction, and does not end it on cancel', () => {
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: /end auction/i }))
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument()
  })
})

describe('AdminConsole keyboard shortcuts', () => {
  it('pressing S calls markSold when a lot is active', async () => {
    const { markSold } = await import('./actions')
    render(<AdminConsole roomId="room-1" initialSnapshot={liveSnapshot} />)
    fireEvent.keyDown(window, { key: 's' })
    await vi.waitFor(() => expect(markSold).toHaveBeenCalledWith('room-1'))
  })

  it('pressing Z calls undoLastBid', async () => {
    const { undoLastBid } = await import('./actions')
    render(<AdminConsole roomId="room-1" initialSnapshot={liveSnapshot} />)
    fireEvent.keyDown(window, { key: 'z' })
    await vi.waitFor(() => expect(undoLastBid).toHaveBeenCalledWith('room-1'))
  })

  it('ignores shortcuts when no lot is active', async () => {
    const { markUnsold } = await import('./actions')
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    fireEvent.keyDown(window, { key: 'u' })
    expect(markUnsold).not.toHaveBeenCalled()
  })
})
