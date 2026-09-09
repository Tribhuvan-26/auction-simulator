import { render, screen } from '@testing-library/react'
import { TeamPurseTable } from './team-purse-table'

const teams = [
  { id: 't1', name: 'Team A', shortCode: 'TMA', colorAccent: '#2074D5', purseTotal: 10000, squad: [], purseRemaining: 9000, squadCount: 3, squadMax: 25, overseasSlotsUsed: 1, overseasSlotsMax: 8 },
  { id: 't2', name: 'Team B', shortCode: 'TMB', colorAccent: '#EB547C', purseTotal: 10000, squad: [], purseRemaining: 8000, squadCount: 4, squadMax: 25, overseasSlotsUsed: 2, overseasSlotsMax: 8 },
]

describe('TeamPurseTable', () => {
  it('renders every team with purse and squad count', () => {
    render(<TeamPurseTable teams={teams} activeBiddingTeamId={null} />)
    expect(screen.getByText('Team A')).toBeInTheDocument()
    expect(screen.getByText('90 Cr')).toBeInTheDocument()
    expect(screen.getByText('Team B')).toBeInTheDocument()
  })

  it('highlights the row for the currently bidding team', () => {
    render(<TeamPurseTable teams={teams} activeBiddingTeamId="t2" />)
    expect(screen.getByTestId('team-row-t2')).toHaveClass('bg-brand-blue')
    expect(screen.getByTestId('team-row-t1')).not.toHaveClass('bg-brand-blue')
  })
})
