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

  it('renders the dimmed overlay when triggered', () => {
    render(<SoldCelebration trigger={1} />)
    const overlay = screen.getByTestId('sold-celebration-overlay')
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveClass('auction-overlay')
  })

  it('contains the animated cricket sprite silhouette and no circular rings', () => {
    const { container } = render(<SoldCelebration trigger={1} />)
    expect(container.querySelector('.cricket-sprite')).toBeInTheDocument()
    expect(container.querySelector('.cricket-silhouette-wrapper')).toBeInTheDocument()
    // Verify circular ring / badge elements are removed
    expect(container.querySelector('.sprite-badge')).toBeNull()
  })

  it('renders pure cricketer silhouette with no text, prices, or cards', () => {
    const { container } = render(<SoldCelebration trigger={1} />)
    expect(container.textContent).toBe('')
    expect(screen.queryByText(/PLAYER ACQUIRED/i)).toBeNull()
    expect(screen.queryByText(/CRORE/i)).toBeNull()
    expect(screen.queryByText(/CR/i)).toBeNull()
    expect(screen.queryByText(/IPL/i)).toBeNull()
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

    // Next trigger
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
