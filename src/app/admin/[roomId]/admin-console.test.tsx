import { render, screen, fireEvent, within } from '@testing-library/react'
import { vi } from 'vitest'
import { AdminConsole } from './admin-console'
import type { AdminSnapshot } from './actions'

vi.mock('@/lib/pin-actions', () => ({ logoutAdmin: vi.fn(), logoutTeam: vi.fn() }))
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
  replaySold: vi.fn(async () => {}),
  restartRoom: vi.fn(async () => baseSnapshot),
  dropFromLot: vi.fn(async () => baseSnapshot),
  recallUnsold: vi.fn(async () => baseSnapshot),
  sendToUnsold: vi.fn(async () => baseSnapshot),
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
  at: 0,
  room: { id: 'room-1', name: 'Room One', phase: 'LIVE', round: 1 },
  currentLot: null,
  teams: [team('team-1', 'DC'), team('team-2', 'CSK')],
  queue: [],
  unsold: [],
  soldLog: [],
    resultLog: [],
}

const liveSnapshot: AdminSnapshot = {
  ...baseSnapshot,
  currentLot: {
    id: 'lot-1', lotNumber: 4, status: 'BIDDING', currentBid: 20, currentBiddingTeamId: 'team-1', timerSeconds: 30, activeBidders: [], droppedTeamIds: [], bidHistory: [],
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

  it('Cmd+S and a held-down key do not sell the lot', async () => {
    const { markSold } = await import('./actions')
    vi.mocked(markSold).mockClear()
    render(<AdminConsole roomId="room-1" initialSnapshot={liveSnapshot} />)
    fireEvent.keyDown(window, { key: 's', metaKey: true })
    fireEvent.keyDown(window, { key: 's', repeat: true })
    expect(markSold).not.toHaveBeenCalled()
  })

  it('does not sell a lot that is already closed', async () => {
    const { markSold } = await import('./actions')
    vi.mocked(markSold).mockClear()
    const sold = { ...liveSnapshot, currentLot: { ...liveSnapshot.currentLot!, status: 'SOLD' } }
    render(<AdminConsole roomId="room-1" initialSnapshot={sold} />)
    fireEvent.keyDown(window, { key: 's' })
    expect(markSold).not.toHaveBeenCalled()
  })

  it('a sold lot puts NEXT PLAYER under the player card, and N calls the next lot', async () => {
    const { advanceToNextLot } = await import('./actions')
    vi.mocked(advanceToNextLot).mockClear()
    const queue = [{ id: 'p2', name: 'Y', role: 'BATTER', basePrice: 20, setNumber: 'Set 1', status: 'UPCOMING', photoUrl: null }]
    const sold = { ...liveSnapshot, queue, currentLot: { ...liveSnapshot.currentLot!, status: 'SOLD' } }
    render(<AdminConsole roomId="room-1" initialSnapshot={sold} />)
    fireEvent.click(screen.getByRole('button', { name: /NEXT PLAYER \[N\]/ }))
    expect(advanceToNextLot).toHaveBeenCalledTimes(1)
  })

  it('a sold lot puts a NEXT PLAYER button under the top of the queue', async () => {
    const { advanceToNextLot } = await import('./actions')
    vi.mocked(advanceToNextLot).mockClear()
    const queue = [{ id: 'p2', name: 'Abhishek Sharma', role: 'BATTER', basePrice: 200, setNumber: 'Capped Players', status: 'UPCOMING', photoUrl: null }]
    const sold = { ...liveSnapshot, queue, currentLot: { ...liveSnapshot.currentLot!, status: 'SOLD' } }
    render(<AdminConsole roomId="room-1" initialSnapshot={sold} />)
    fireEvent.click(screen.getByRole('button', { name: /NEXT PLAYER: Abhishek Sharma/i }))
    expect(advanceToNextLot).toHaveBeenCalledTimes(1)
  })

    it('space pauses the room through setPhase', async () => {
    const { setPhase } = await import('./actions')
    render(<AdminConsole roomId="room-1" initialSnapshot={liveSnapshot} />)
    fireEvent.keyDown(window, { key: ' ' })
    await vi.waitFor(() => expect(setPhase).toHaveBeenCalledWith('room-1', 'PAUSED'))
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
    // Lot is BIDDING at 20 L, so the ladder's next rung is 30 L.
    fireEvent.click(screen.getByTestId('bid-CSK'))
    await vi.waitFor(() => expect(placeBid).toHaveBeenCalledWith('room-1', 'team-2', 30))
  })

  it('jump bid takes crore and sends lakhs to forceBid, which checks it against the ladder', async () => {
    const { forceBid, placeBid } = await import('./actions')
    render(<AdminConsole roomId="room-1" initialSnapshot={liveSnapshot} />)
    // The server rejects an off-ladder amount; the console just passes it on.
    fireEvent.change(screen.getByLabelText(/^amount$/i), { target: { value: '9.99' } })
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

  it('greys out the team bid buttons while the room is paused', () => {
    const paused = { ...liveSnapshot, room: { ...liveSnapshot.room, phase: 'PAUSED' } }
    render(<AdminConsole roomId="room-1" initialSnapshot={paused} />)
    expect(screen.getByTestId('bid-CSK')).toBeDisabled()
  })

  it('UNDO stays available on an UNSOLD lot, which has no bids to undo', () => {
    const unsold = { ...liveSnapshot, currentLot: { ...liveSnapshot.currentLot!, status: 'UNSOLD', currentBiddingTeamId: null } }
    render(<AdminConsole roomId="room-1" initialSnapshot={unsold} />)
    expect(screen.getByRole('button', { name: /undo bid/i })).toBeEnabled()
  })

  it('S still sells right after a team tile was clicked (the button keeps focus)', async () => {
    const { markSold } = await import('./actions')
    vi.mocked(markSold).mockClear()
    render(<AdminConsole roomId="room-1" initialSnapshot={liveSnapshot} />)
    const tile = screen.getByTestId('bid-CSK')
    tile.focus()
    fireEvent.keyDown(tile, { key: 's' })
    await vi.waitFor(() => expect(markSold).toHaveBeenCalledWith('room-1'))
  })

  it('PAUSE is off before the first lot, so a room cannot start paused', () => {
    const setup = { ...baseSnapshot, room: { ...baseSnapshot.room, phase: 'SETUP' } }
    render(<AdminConsole roomId="room-1" initialSnapshot={setup} />)
    expect(screen.getByRole('button', { name: /pause/i })).toBeDisabled()
  })

  it('an ended auction can be reopened', async () => {
    const { setPhase } = await import('./actions')
    const ended = { ...baseSnapshot, room: { ...baseSnapshot.room, phase: 'COMPLETED' } }
    render(<AdminConsole roomId="room-1" initialSnapshot={ended} />)
    fireEvent.click(screen.getByRole('button', { name: /reopen auction/i }))
    await vi.waitFor(() => expect(setPhase).toHaveBeenCalledWith('room-1', 'LIVE'))
  })

  it('an ended auction can be started over, after confirming', async () => {
    const { restartRoom } = await import('./actions')
    const ended = { ...baseSnapshot, room: { ...baseSnapshot.room, phase: 'COMPLETED' } }
    render(<AdminConsole roomId="room-1" initialSnapshot={ended} />)
    fireEvent.click(screen.getByRole('button', { name: /^start new auction$/i }))
    expect(restartRoom).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: /^start new auction$/i }).at(-1)!)
    await vi.waitFor(() => expect(restartRoom).toHaveBeenCalledWith('room-1'))
  })

  it('an ended auction shows the result without opening STANDINGS', () => {
    const ended = {
      ...baseSnapshot,
      room: { ...baseSnapshot.room, phase: 'COMPLETED' },
      teams: [{ ...team('team-1', 'DC'), purseRemaining: 6000 }, team('team-2', 'CSK')],
    }
    render(<AdminConsole roomId="room-1" initialSnapshot={ended} />)
    expect(screen.getByTestId('final-result')).toHaveTextContent(/winner: CSK Team \(CSK\)/i)
  })

  it('an ended auction picks the best score even with no legal squad', () => {
    const ended = {
      ...baseSnapshot,
      room: { ...baseSnapshot.room, phase: 'COMPLETED' },
      teams: [team('team-1', 'DC'), { ...team('team-2', 'CSK'), purseRemaining: 6000 }],
    }
    render(<AdminConsole roomId="room-1" initialSnapshot={ended} />)
    expect(screen.getByTestId('final-result')).toHaveTextContent(/winner: DC Team \(DC\)/i)
  })

  it('BACK TO UNSOLD brings the unsold players back', async () => {
    const { recallUnsold } = await import('./actions')
    const s = { ...baseSnapshot, unsold: [{ id: 'p1', name: 'X', role: 'BATTER' }] }
    render(<AdminConsole roomId="room-1" initialSnapshot={s} />)
    fireEvent.click(screen.getByRole('button', { name: /back to unsold \(1\)/i }))
    await vi.waitFor(() => expect(recallUnsold).toHaveBeenCalledWith('room-1'))
  })

  it('BRING BACK calls back just that unsold player', async () => {
    const { recallUnsold } = await import('./actions')
    const s = { ...baseSnapshot, unsold: [{ id: 'p1', name: 'X', role: 'BATTER' }] }
    render(<AdminConsole roomId="room-1" initialSnapshot={s} />)
    fireEvent.click(screen.getByRole('button', { name: /^bring back$/i }))
    await vi.waitFor(() => expect(recallUnsold).toHaveBeenCalledWith('room-1', 'p1'))
  })

  it('TO UNSOLD moves a queued player onto the unsold list', async () => {
    const { sendToUnsold } = await import('./actions')
    const s = { ...baseSnapshot, queue: [{ id: 'q1', name: 'Q', role: 'BATTER', basePrice: 50, setNumber: 'Set 1', status: 'UPCOMING', photoUrl: null }] }
    render(<AdminConsole roomId="room-1" initialSnapshot={s} />)
    fireEvent.click(screen.getByRole('button', { name: /^to unsold$/i }))
    await vi.waitFor(() => expect(sendToUnsold).toHaveBeenCalledWith('room-1', 'q1'))
  })

  it('CALL puts the picked player on the block, not the front of the queue', async () => {
    const { advanceToNextLot } = await import('./actions')
    const q = (id: string) => ({ id, name: id.toUpperCase(), role: 'BATTER', basePrice: 50, setNumber: 'Set 1', status: 'UPCOMING', photoUrl: null })
    render(<AdminConsole roomId="room-1" initialSnapshot={{ ...baseSnapshot, queue: [q('q1'), q('q2')] }} />)
    fireEvent.click(screen.getAllByRole('button', { name: /^call$/i })[1])
    await vi.waitFor(() => expect(advanceToNextLot).toHaveBeenCalledWith('room-1', 'q2'))
  })

  it('CALL is off while a player is on the block', () => {
    const q = { id: 'q1', name: 'Q', role: 'BATTER', basePrice: 50, setNumber: 'Set 1', status: 'UPCOMING', photoUrl: null }
    render(<AdminConsole roomId="room-1" initialSnapshot={{ ...liveSnapshot, queue: [q] }} />)
    expect(screen.getByRole('button', { name: /^call$/i })).toBeDisabled()
  })

  it('BACK TO UNSOLD is off with no unsold players', () => {
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    expect(screen.getByRole('button', { name: /back to unsold \(0\)/i })).toBeDisabled()
  })

  it('a live auction shows no result yet', () => {
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    expect(screen.queryByTestId('final-result')).toBeNull()
  })

  it('shows the two teams that are in, and which one leads', () => {
    const s = { ...liveSnapshot, currentLot: { ...liveSnapshot.currentLot!, activeBidders: ['team-1', 'team-2'] } }
    render(<AdminConsole roomId="room-1" initialSnapshot={s} />)
    expect(screen.getByText(/teams in · 2\/2/i)).toBeInTheDocument()
    expect(screen.getByTestId('in-DC')).toHaveTextContent(/leading/i)
    expect(within(screen.getByTestId('in-DC')).queryByRole('button', { name: /^drop$/i })).toBeNull()
  })

  it('BID on a team that is in raises for it', async () => {
    const { placeBid } = await import('./actions')
    const s = { ...liveSnapshot, currentLot: { ...liveSnapshot.currentLot!, activeBidders: ['team-1', 'team-2'] } }
    render(<AdminConsole roomId="room-1" initialSnapshot={s} />)
    fireEvent.click(within(screen.getByTestId('in-CSK')).getByRole('button', { name: /^bid /i }))
    await vi.waitFor(() => expect(placeBid).toHaveBeenCalledWith('room-1', 'team-2', 30))
  })

  it('DROP on a team that is in takes it out', async () => {
    const { dropFromLot } = await import('./actions')
    const s = { ...liveSnapshot, currentLot: { ...liveSnapshot.currentLot!, activeBidders: ['team-1', 'team-2'] } }
    render(<AdminConsole roomId="room-1" initialSnapshot={s} />)
    fireEvent.click(within(screen.getByTestId('in-CSK')).getByRole('button', { name: /^drop$/i }))
    await vi.waitFor(() => expect(dropFromLot).toHaveBeenCalledWith('room-1', 'team-2'))
  })

  it('shows open slots until two teams are in', () => {
    const s = { ...liveSnapshot, currentLot: { ...liveSnapshot.currentLot!, currentBiddingTeamId: null, activeBidders: [] } }
    render(<AdminConsole roomId="room-1" initialSnapshot={s} />)
    expect(screen.getByText(/teams in · 0\/2/i)).toBeInTheDocument()
    expect(screen.getByText(/slot 1 open/i)).toBeInTheDocument()
    expect(screen.getByText(/slot 2 open/i)).toBeInTheDocument()
  })

  it('renders a purse row per team', () => {
    render(<AdminConsole roomId="room-1" initialSnapshot={baseSnapshot} />)
    expect(screen.getByTestId('purse-DC')).toBeInTheDocument()
    expect(screen.getByTestId('purse-CSK')).toBeInTheDocument()
  })
})
