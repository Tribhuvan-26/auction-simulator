import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamConsole } from './team-console'
import type { PublicSnapshot } from '@/app/admin/[roomId]/actions'

vi.mock('@/lib/pin-actions', () => ({ logoutAdmin: vi.fn(), logoutTeam: vi.fn() }))
vi.mock('@/hooks/use-live-snapshot', () => ({
  useLiveSnapshot: (_roomId: string, initial: PublicSnapshot) => ({
    snapshot: initial,
    setSnapshot: vi.fn(),
  }),
}))
vi.mock('@/app/admin/[roomId]/actions', () => ({
  getPublicSnapshot: vi.fn(async () => ({})),
  placeBid: vi.fn(async () => {}),
  claimLot: vi.fn(async () => ({ at: 0 })),
}))

const team = (over: Partial<PublicSnapshot['teams'][number]> = {}): PublicSnapshot['teams'][number] => ({
  id: 'team-1',
  name: 'Delhi Capitals',
  shortCode: 'DC',
  colorAccent: '#17479E',
  logoUrl: null,
  purseTotal: 12000,
  purseRemaining: 12000,
  squadCount: 0,
  squadMax: 25,
  overseasSlotsUsed: 0,
  overseasSlotsMax: 8,
  squad: [],
  ...over,
})

function snapshot(over: Partial<PublicSnapshot> = {}, teamOver = {}): PublicSnapshot {
  return {
    at: 0,
    room: { id: 'room-1', name: 'Room One', phase: 'LIVE', round: 1 },
    currentLot: {
      id: 'lot-1',
      lotNumber: 4,
      status: 'QUEUED',
      currentBid: 20,
      currentBiddingTeamId: null,
      timerSeconds: 30,
      activeBidders: [],
      droppedTeamIds: [],
      bidHistory: [],
      player: {
        id: 'p1', name: 'Test Player', role: 'BATTER', basePrice: 20, photoUrl: null,
        nationality: 'India', matches: 0, runs: null, wickets: null, average: null,
        strikeRate: null, economy: null, isOverseas: false, setNumber: 'Set 1',
      },
    },
    teams: [team(teamOver), team({ id: 'team-2', name: 'Chennai Super Kings', shortCode: 'CSK' })],
    soldLog: [],
    resultLog: [],
    ...over,
  }
}

function renderConsole(s: PublicSnapshot) {
  return render(<TeamConsole roomId="room-1" teamId="team-1" initialSnapshot={s} />)
}

describe('TeamConsole bidding panel (I\'M IN — the auctioneer enters every bid)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has no BID, PASS or DROP button', () => {
    renderConsole(snapshot())
    expect(screen.queryByRole('button', { name: /^bid$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /pass|drop/i })).toBeNull()
  })

  it("I'M IN claims a place in the lot, and never bids", async () => {
    const { claimLot, placeBid } = await import('@/app/admin/[roomId]/actions')
    renderConsole(snapshot())
    fireEvent.click(screen.getByRole('button', { name: /i'm in/i }))
    await vi.waitFor(() => expect(claimLot).toHaveBeenCalledWith('room-1', 'team-1'))
    expect(placeBid).not.toHaveBeenCalled()
  })

  it("the spacebar presses I'M IN", async () => {
    const { claimLot } = await import('@/app/admin/[roomId]/actions')
    renderConsole(snapshot())
    fireEvent.keyDown(window, { key: ' ' })
    await vi.waitFor(() => expect(claimLot).toHaveBeenCalledWith('room-1', 'team-1'))
  })

  it('ignores the spacebar while a modal is open or the key is held down', async () => {
    const { claimLot } = await import('@/app/admin/[roomId]/actions')
    renderConsole(snapshot())
    fireEvent.keyDown(window, { key: ' ', repeat: true })
    fireEvent.click(screen.getByRole('button', { name: /^squad$/i }))
    fireEvent.keyDown(window, { key: ' ' })
    expect(claimLot).not.toHaveBeenCalled()
  })

  it("shows YOU'RE IN once this team is one of the two", () => {
    const s = snapshot()
    s.currentLot!.activeBidders = ['team-1']
    renderConsole(s)
    expect(screen.getByRole('button', { name: /you're in/i })).toBeDisabled()
  })

  it('shuts a third team out while two teams are in', () => {
    const s = snapshot()
    s.currentLot!.activeBidders = ['team-2', 'team-3']
    renderConsole(s)
    expect(screen.getByRole('button', { name: /i'm in/i })).toBeDisabled()
    expect(screen.getByText(/two teams are bidding/i)).toBeInTheDocument()
  })

  it('is shut while there is no lot on the block', () => {
    renderConsole(snapshot({ currentLot: null }))
    expect(screen.getByRole('button', { name: /i'm in/i })).toBeDisabled()
    expect(screen.getByText(/waiting for the auctioneer/i)).toBeInTheDocument()
  })

  it('is shut while the auction is paused', () => {
    renderConsole(snapshot({ room: { id: 'room-1', name: 'Room One', phase: 'PAUSED', round: 1 } }))
    expect(screen.getByRole('button', { name: /i'm in/i })).toBeDisabled()
  })

  it('explains when the purse cannot cover the next bid', () => {
    renderConsole(snapshot({}, { purseRemaining: 10 }))
    expect(screen.getByRole('button', { name: /i'm in/i })).toBeDisabled()
    expect(screen.getByText(/purse insufficient/i)).toBeInTheDocument()
  })

  it('shows which two teams are in', () => {
    const s = snapshot()
    s.currentLot!.activeBidders = ['team-1', 'team-2']
    renderConsole(s)
    expect(screen.getByText(/in: dc vs csk/i)).toBeInTheDocument()
  })
})

describe('TeamConsole team status', () => {
  it('shows signed players with their price', () => {
    renderConsole(
      snapshot({}, {
        squadCount: 1,
        squad: [{ id: 'p9', name: 'KL Rahul', role: 'WICKET_KEEPER', price: 1400, photoUrl: null, isOverseas: false }],
      })
    )
    fireEvent.click(screen.getByRole('button', { name: /^squad$/i }))
    expect(screen.getByText(/KL Rahul/)).toBeInTheDocument()
    expect(screen.getByText('14 Cr')).toBeInTheDocument()
  })
})
