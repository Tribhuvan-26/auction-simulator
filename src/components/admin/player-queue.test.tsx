import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { PlayerQueue } from './player-queue'
import type { AdminSnapshot } from '@/app/admin/[roomId]/actions'

vi.mock('@/app/admin/[roomId]/actions', () => ({
  advanceToNextLot: vi.fn(async () => ({ room: { id: 'r1', phase: 'LIVE', round: 1 }, currentLot: null, teams: [], queue: [] }) as AdminSnapshot),
}))

const queue: AdminSnapshot['queue'] = [
  { id: 'p1', name: 'Alice Batter', role: 'BATTER', basePrice: 20, setNumber: 'Marquee Set', status: 'UPCOMING' },
  { id: 'p2', name: 'Bob Bowler', role: 'BOWLER', basePrice: 30, setNumber: 'Set 2', status: 'UPCOMING' },
]

describe('PlayerQueue', () => {
  it('renders every queued player', () => {
    render(<PlayerQueue roomId="r1" queue={queue} onSnapshot={vi.fn()} />)
    expect(screen.getByText(/Alice Batter/)).toBeInTheDocument()
    expect(screen.getByText(/Bob Bowler/)).toBeInTheDocument()
  })

  it('filters by search text', () => {
    render(<PlayerQueue roomId="r1" queue={queue} onSnapshot={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Alice' } })
    expect(screen.getByText(/Alice Batter/)).toBeInTheDocument()
    expect(screen.queryByText(/Bob Bowler/)).not.toBeInTheDocument()
  })

  it('filters by role', () => {
    render(<PlayerQueue roomId="r1" queue={queue} onSnapshot={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'BOWLER' } })
    expect(screen.queryByText(/Alice Batter/)).not.toBeInTheDocument()
    expect(screen.getByText(/Bob Bowler/)).toBeInTheDocument()
  })

  it('calls advanceToNextLot and reports the new snapshot when Load Next is clicked', async () => {
    const { advanceToNextLot } = await import('@/app/admin/[roomId]/actions')
    const onSnapshot = vi.fn()
    render(<PlayerQueue roomId="r1" queue={queue} onSnapshot={onSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: /load next/i }))
    await vi.waitFor(() => expect(advanceToNextLot).toHaveBeenCalledWith('r1'))
    await vi.waitFor(() => expect(onSnapshot).toHaveBeenCalled())
  })
})
