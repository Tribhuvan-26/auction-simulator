import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { AdminConsole } from './admin-console'
import type { AdminSnapshot } from './actions'

vi.mock('@/hooks/use-live-snapshot', () => ({
  useLiveSnapshot: (_roomId: string, initial: AdminSnapshot) => ({
    snapshot: initial,
    setSnapshot: vi.fn(),
    lastEvent: null,
  }),
}))
vi.mock('./actions', () => ({
  getAdminSnapshot: vi.fn(async () => baseSnapshot),
  setPhase: vi.fn(async () => baseSnapshot),
  markSold: vi.fn(async () => baseSnapshot),
  markUnsold: vi.fn(async () => baseSnapshot),
  undoLastBid: vi.fn(async () => baseSnapshot),
  controlTimer: vi.fn(async () => baseSnapshot),
  placeBid: vi.fn(async () => baseSnapshot),
  forceBid: vi.fn(async () => baseSnapshot),
  advanceToNextLot: vi.fn(async () => baseSnapshot),
}))

const team = (id: string, shortCode: string): AdminSnapshot['teams'][number] => ({
  id,
  shortCode,
  name: `${shortCode} Team`,
  colorAccent: '#2074D5',
  logoUrl: null,
  purseTotal: 12000,
  purseRemaining: 12000,
  squadCount: 0,
  squadMax: 25,
  overseasSlotsUsed: 0,
  overseasSlotsMax: 8,
  squad: [],
})

const baseSnapshot: AdminSnapshot = {
  room: { id: 'room-1', name: 'Room One', phase: 'LIVE', round: 1 },
  currentLot: null,
  teams: [team('team-1', 'DC'), team('team-2', 'CSK')],
  queue: [],
  soldLog: [],
}

const liveSnapshot: AdminSnapshot = {
  ...baseSnapshot,
  currentLot: {
    id: 'lot-1', lotNumber: 4, status: 'BIDDING', currentBid: 20, currentBiddingTeamId: 'team-1', timerSeconds: 30, bidHistory: [],
    player: { id: 'p1', name: 'X', role: 'BATTER', basePrice: 20, photoUrl: null, nationality: 'India', matches: 1, runs: null, wickets: null, average: null, strikeRate: null, economy: null, isOverseas: false, setNumber: 'Set 1' },
  },
}

describe('AdminConsole', () => {
  it('renders the phase pill showing the current phase', () => {
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('shows a confirm modal before ending the auction, and does not end it on cancel', async () => {
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: /end auction/i }))
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    // AnimatePresence keeps the modal mounted through its exit animation.
    await vi.waitFor(() => expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument())
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

describe('AdminConsole bidding grid', () => {
  it('bids the next amount on the ladder for the team clicked', async () => {
    const { placeBid } = await import('./actions')
    render(<AdminConsole roomId="room-1" initialSnapshot={liveSnapshot} />)
    // Lot is BIDDING at 20 L, so the ladder's next rung is 25 L.
    fireEvent.click(screen.getByTestId('bid-CSK'))
    await vi.waitFor(() => expect(placeBid).toHaveBeenCalledWith('room-1', 'team-2', 25))
  })

  it('jump bid sends the entered amount straight to forceBid, off the ladder and unblocked by placeBid', async () => {
    const { forceBid, placeBid } = await import('./actions')
    render(<AdminConsole roomId="room-1" initialSnapshot={liveSnapshot} />)
    // Ladder's next rung is 25 L; 999 is deliberately off-tier.
    fireEvent.change(screen.getByLabelText(/^amount$/i), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: /^bid$/i }))
    await vi.waitFor(() => expect(forceBid).toHaveBeenCalledWith('room-1', 'team-1', 999))
    expect(placeBid).not.toHaveBeenCalled()
  })

  it('disables every team button when no lot is on the block', () => {
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    expect(screen.getByTestId('bid-DC')).toBeDisabled()
    expect(screen.getByTestId('bid-CSK')).toBeDisabled()
  })

  it('does not fire a shortcut while the jump-bid box has focus', async () => {
    const { markSold } = await import('./actions')
    render(<AdminConsole roomId="room-1" initialSnapshot={liveSnapshot} />)
    const jump = screen.getByLabelText(/^amount$/i)
    jump.focus()
    fireEvent.keyDown(jump, { key: 's' })
    expect(markSold).not.toHaveBeenCalled()
  })

  it('renders a purse row per team', () => {
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    expect(screen.getByTestId('purse-DC')).toBeInTheDocument()
    expect(screen.getByTestId('purse-CSK')).toBeInTheDocument()
  })
})
