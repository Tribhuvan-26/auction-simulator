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
  getPublicSnapshot: vi.fn(),
  placeBid: vi.fn(async () => {}),
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

describe('TeamConsole bidding panel (view only — the auctioneer enters every bid)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has no BID, PASS or DROP button', () => {
    const s = snapshot()
    s.currentLot!.status = 'BIDDING'
    s.currentLot!.currentBiddingTeamId = 'team-2'
    s.currentLot!.activeBidders = ['team-1', 'team-2']
    renderConsole(s)
    expect(screen.queryByRole('button', { name: /^bid$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /pass|drop/i })).toBeNull()
  })

  it('the spacebar does not bid', async () => {
    const { placeBid } = await import('@/app/admin/[roomId]/actions')
    renderConsole(snapshot())
    fireEvent.keyDown(window, { key: ' ' })
    expect(placeBid).not.toHaveBeenCalled()
  })

  it('tells the team to call out while a bid from them would be taken', () => {
    renderConsole(snapshot())
    expect(screen.getByText(/raise your paddle to bid/i)).toBeInTheDocument()
  })

  it('says so while this team already holds the lot', () => {
    const s = snapshot()
    s.currentLot!.currentBiddingTeamId = 'team-1'
    renderConsole(s)
    expect(screen.getByText(/you hold the highest bid/i)).toBeInTheDocument()
  })

  it('says so when there is no lot on the block', () => {
    renderConsole(snapshot({ currentLot: null }))
    expect(screen.getByText(/waiting for the auctioneer/i)).toBeInTheDocument()
  })

  it('explains when the purse cannot cover the next bid', () => {
    renderConsole(snapshot({}, { purseRemaining: 10 }))
    expect(screen.getByText(/purse insufficient/i)).toBeInTheDocument()
  })

  it('shows which two teams are bidding', () => {
    const s = snapshot()
    s.currentLot!.status = 'BIDDING'
    s.currentLot!.currentBiddingTeamId = 'team-2'
    s.currentLot!.activeBidders = ['team-1', 'team-2']
    renderConsole(s)
    expect(screen.getByText(/bidding: dc vs csk/i)).toBeInTheDocument()
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
