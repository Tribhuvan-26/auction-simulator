import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamConsole } from './team-console'
import type { PublicSnapshot } from '@/app/admin/[roomId]/actions'

vi.mock('@/hooks/use-live-snapshot', () => ({
  useLiveSnapshot: (_roomId: string, initial: PublicSnapshot) => ({
    snapshot: initial,
    setSnapshot: vi.fn(),
  }),
}))
vi.mock('@/app/admin/[roomId]/actions', () => ({
  getPublicSnapshot: vi.fn(),
  placeBid: vi.fn(async () => {}),
}))

const team = (over: Partial<PublicSnapshot['teams'][number]> = {}): PublicSnapshot['teams'][number] => ({
  id: 'team-1',
  name: 'Delhi Capitals',
  shortCode: 'DC',
  colorAccent: '#17479E',
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
    room: { id: 'room-1', name: 'Room One', phase: 'LIVE', round: 1 },
    currentLot: {
      id: 'lot-1',
      status: 'BIDDING',
      currentBid: 20,
      currentBiddingTeamId: null,
      timerSeconds: 30,
      bidHistory: [],
      player: {
        id: 'p1', name: 'Test Player', role: 'BATTER', basePrice: 20, photoUrl: null,
        nationality: 'India', matches: 0, runs: null, wickets: null, average: null,
        strikeRate: null, economy: null, isOverseas: false, setNumber: 'Set 1',
      },
    },
    teams: [team(teamOver), team({ id: 'team-2', name: 'Chennai Super Kings', shortCode: 'CSK' })],
    soldLog: [],
    ...over,
  }
}

function renderConsole(s: PublicSnapshot) {
  return render(<TeamConsole roomId="room-1" teamId="team-1" initialSnapshot={s} />)
}

describe('TeamConsole paddle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads "Raise Paddle" and bids the ladder amount when another team can be beaten', async () => {
    const { placeBid } = await import('@/app/admin/[roomId]/actions')
    renderConsole(snapshot())
    const paddle = screen.getByRole('button', { name: /raise paddle/i })
    expect(paddle).not.toBeDisabled()
    fireEvent.click(paddle)
    // Lot is BIDDING at 20 L, so the ladder's next rung is 25 L.
    await vi.waitFor(() => expect(placeBid).toHaveBeenCalledWith('room-1', 'team-1', 25))
  })

  it('locks out while this team already holds the lot', () => {
    const s = snapshot()
    s.currentLot!.currentBiddingTeamId = 'team-1'
    renderConsole(s)
    expect(screen.getByRole('button', { name: /you hold the bid/i })).toBeDisabled()
  })

  it('waits when there is no lot on the block', () => {
    renderConsole(snapshot({ currentLot: null }))
    expect(screen.getByRole('button', { name: /waiting for auctioneer/i })).toBeDisabled()
  })

  it('waits when the lot has been called', () => {
    const s = snapshot()
    s.currentLot!.status = 'SOLD'
    renderConsole(s)
    expect(screen.getByRole('button', { name: /waiting for auctioneer/i })).toBeDisabled()
  })

  it('locks out and explains when the purse cannot cover the next bid', () => {
    renderConsole(snapshot({}, { purseRemaining: 10 }))
    expect(screen.getByRole('button', { name: /waiting for auctioneer/i })).toBeDisabled()
    expect(screen.getByText(/purse insufficient/i)).toBeInTheDocument()
  })

  it('raises on the spacebar', async () => {
    const { placeBid } = await import('@/app/admin/[roomId]/actions')
    renderConsole(snapshot())
    fireEvent.keyDown(window, { key: ' ' })
    await vi.waitFor(() => expect(placeBid).toHaveBeenCalledWith('room-1', 'team-1', 25))
  })
})

describe('TeamConsole squad matrix', () => {
  it('shows an empty ring per unfilled slot', () => {
    renderConsole(snapshot())
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText(/0 signed • 25 slots open/i)).toBeInTheDocument()
  })

  it('shows signed players with their price', () => {
    renderConsole(
      snapshot({}, {
        squadCount: 1,
        squad: [{ id: 'p9', name: 'KL Rahul', role: 'WICKET_KEEPER', price: 1400, photoUrl: null }],
      })
    )
    expect(screen.getByText('KL Rahul')).toBeInTheDocument()
    expect(screen.getByText('14 Cr')).toBeInTheDocument()
  })
})
