import { render, screen, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SoldCelebration } from './sold-celebration'

describe('SoldCelebration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('remains completely hidden (idle) when not active', () => {
    render(<SoldCelebration />)
    expect(screen.queryByTestId('sold-celebration-overlay')).toBeNull()
  })

  it('renders the cricketer emblem overlay when triggered', () => {
    render(<SoldCelebration trigger={1} />)
    const overlay = screen.getByTestId('sold-celebration-overlay')
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveClass('auction-overlay')
  })

  it('contains the official sprite badge and animated cricket sprite', () => {
    const { container } = render(<SoldCelebration trigger={1} />)
    expect(container.querySelector('.sprite-badge')).toBeInTheDocument()
    expect(container.querySelector('.cricket-sprite')).toBeInTheDocument()
  })

  it('renders badge-only with no text when no player is passed', () => {
    const { container } = render(<SoldCelebration trigger={1} badgeOnly={true} />)
    expect(container.textContent).toBe('')
    expect(screen.queryByText(/PLAYER ACQUIRED/i)).toBeNull()
    expect(screen.queryByText(/CRORE/i)).toBeNull()
    expect(screen.queryByText(/CR/i)).toBeNull()
  })

  it('renders player acquired modal with name and formatted price when player prop is passed', () => {
    render(
      <SoldCelebration
        trigger={1}
        player={{
          name: 'Virat Kohli',
          price: 145000000,
        }}
      />
    )
    expect(screen.getByText('PLAYER ACQUIRED!')).toBeInTheDocument()
    expect(screen.getByText('Virat Kohli')).toBeInTheDocument()
    expect(screen.getByText('₹14.50 CR')).toBeInTheDocument()
    expect(screen.getByText('IPL Auction 2026')).toBeInTheDocument()
  })

  it('automatically completes and clears after the animation lifecycle (~2400ms)', () => {
    const onComplete = vi.fn()
    render(<SoldCelebration trigger={1} onComplete={onComplete} />)

    expect(screen.getByTestId('sold-celebration-overlay')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2400)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('sold-celebration-overlay')).toBeNull()
  })

  it('supports repeated triggers across consecutive player sales', () => {
    const { rerender } = render(<SoldCelebration trigger={1} />)
    expect(screen.getByTestId('sold-celebration-overlay')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2400)
    })
    expect(screen.queryByTestId('sold-celebration-overlay')).toBeNull()

    // Next player sold!
    rerender(<SoldCelebration trigger={2} />)
    expect(screen.getByTestId('sold-celebration-overlay')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2400)
    })
    expect(screen.queryByTestId('sold-celebration-overlay')).toBeNull()
  })

  it('triggers when window.showSoldAnimation() is invoked', () => {
    render(<SoldCelebration />)
    expect(screen.queryByTestId('sold-celebration-overlay')).toBeNull()

    act(() => {
      ;(window as unknown as { showSoldAnimation: () => void }).showSoldAnimation()
    })

    expect(screen.getByTestId('sold-celebration-overlay')).toBeInTheDocument()
  })

  it('triggers when custom window event "auction:sold" is dispatched', () => {
    render(<SoldCelebration />)
    expect(screen.queryByTestId('sold-celebration-overlay')).toBeNull()

    act(() => {
      window.dispatchEvent(new CustomEvent('auction:sold', { detail: { type: 'SOLD' } }))
    })

    expect(screen.getByTestId('sold-celebration-overlay')).toBeInTheDocument()
  })
})
