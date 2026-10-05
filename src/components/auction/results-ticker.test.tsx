import { render, screen } from '@testing-library/react'
import { ResultsTicker } from './results-ticker'

const sold = { id: 'l2', playerName: 'Virat Kohli', status: 'SOLD' as const, price: 2100, teamShortCode: 'RCB', colorAccent: '#EC1C24' }
const unsold = { id: 'l1', playerName: 'Player X', status: 'UNSOLD' as const, price: null, teamShortCode: null, colorAccent: null }

describe('ResultsTicker', () => {
  it('shows a placeholder when nothing has closed yet', () => {
    render(<ResultsTicker results={[]} />)
    expect(screen.getByText(/auction starting soon/i)).toBeInTheDocument()
  })

  it('shows a sale with the team code in its colour and the formatted price', () => {
    render(<ResultsTicker results={[sold]} />)
    const [code] = screen.getAllByText('RCB')
    expect(code).toHaveStyle({ backgroundColor: '#EC1C24' })
    expect(screen.getAllByText('21 Cr')).toHaveLength(2) // two copies for the loop
    expect(screen.queryByText(/auction starting soon/i)).toBeNull()
  })

  it('shows an unsold lot with no team or price, newest first', () => {
    render(<ResultsTicker results={[sold, unsold]} />)
    expect(screen.getAllByText('UNSOLD')).toHaveLength(2)
    const names = screen.getAllByText(/Virat Kohli|Player X/).map((n) => n.textContent)
    expect(names.slice(0, 2)).toEqual(['Virat Kohli', 'Player X'])
  })
})
