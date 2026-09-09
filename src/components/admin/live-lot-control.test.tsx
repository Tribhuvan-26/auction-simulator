import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { LiveLotControl } from './live-lot-control'
import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'

vi.mock('@/app/admin/[roomId]/actions', () => ({
  placeBid: vi.fn(async () => ({}) as AdminSnapshot),
  markSold: vi.fn(async () => ({}) as AdminSnapshot),
  markUnsold: vi.fn(async () => ({}) as AdminSnapshot),
  undoLastBid: vi.fn(async () => ({}) as AdminSnapshot),
  controlTimer: vi.fn(async () => ({}) as AdminSnapshot),
}))

const snapshotWithTeam: AdminSnapshot = {
  room: { id: 'r1', phase: 'LIVE', round: 1 },
  currentLot: {
    id: 'lot-1', status: 'BIDDING', currentBid: 50, currentBiddingTeamId: 'team-1', timerSeconds: 30,
    bidHistory: [],
    player: { id: 'p1', name: 'Test Player', role: 'BATTER', basePrice: 20, photoUrl: null, nationality: 'India', matches: 10, runs: null, wickets: null, average: null, strikeRate: null, economy: null },
  },
  teams: [{ id: 'team-1', name: 'Team A', shortCode: 'TMA', colorAccent: '#2074D5', purseRemaining: 9950, squadCount: 0, squadMax: 25, overseasSlotsUsed: 0, overseasSlotsMax: 8 }],
  queue: [],
}

const snapshotNoTeam: AdminSnapshot = { ...snapshotWithTeam, currentLot: { ...snapshotWithTeam.currentLot!, currentBiddingTeamId: null } }

describe('LiveLotControl', () => {
  it('shows the current player name and bid', () => {
    render(<LiveLotControl roomId="r1" snapshot={snapshotWithTeam} onSnapshot={vi.fn()} />)
    expect(screen.getByText('Test Player')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('disables the SOLD button when no bidding team is set', () => {
    render(<LiveLotControl roomId="r1" snapshot={snapshotNoTeam} onSnapshot={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^sold$/i })).toBeDisabled()
  })

  it('enables the SOLD button when a bidding team is set', () => {
    render(<LiveLotControl roomId="r1" snapshot={snapshotWithTeam} onSnapshot={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^sold$/i })).not.toBeDisabled()
  })

  it('calls placeBid with the current bid plus the quick-increment amount for the first eligible team', async () => {
    const { placeBid } = await import('@/app/admin/[roomId]/actions')
    render(<LiveLotControl roomId="r1" snapshot={snapshotWithTeam} onSnapshot={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '+5L' }))
    await vi.waitFor(() => expect(placeBid).toHaveBeenCalledWith('r1', 'team-1', 55))
  })
})
