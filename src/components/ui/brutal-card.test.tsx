import { render, screen } from '@testing-library/react'
import { BrutalCard } from './brutal-card'

describe('BrutalCard', () => {
  it('renders children with the default brutalist border and shadow', () => {
    render(<BrutalCard>Hello</BrutalCard>)
    const card = screen.getByText('Hello')
    expect(card).toHaveClass('border-brand-charcoal')
    expect(card).toHaveClass('shadow-brutal')
  })

  it('applies the pressed variant with a shrunk shadow and no blur', () => {
    render(<BrutalCard variant="pressed">Pressed</BrutalCard>)
    expect(screen.getByText('Pressed')).toHaveClass('shadow-brutal-pressed')
  })

  it('applies the sold variant with a yellow-accented border', () => {
    render(<BrutalCard variant="sold">Sold</BrutalCard>)
    expect(screen.getByText('Sold')).toHaveClass('border-brand-yellow')
  })

  it('applies the unsold variant with a desaturated fill', () => {
    render(<BrutalCard variant="unsold">Unsold</BrutalCard>)
    expect(screen.getByText('Unsold')).toHaveClass('bg-brand-white/60')
  })
})
