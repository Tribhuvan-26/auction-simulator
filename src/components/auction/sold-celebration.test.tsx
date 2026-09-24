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
    expect(overlay).toHaveClass('pointer-events-none')
  })

  it('contains all 4 kinetic SVG layer groups and motion streak', () => {
    const { container } = render(<SoldCelebration trigger={1} />)
    
    expect(container.querySelector('#cricketer-layer-swoosh')).toBeInTheDocument()
    expect(container.querySelector('#cricketer-layer-body')).toBeInTheDocument()
    expect(container.querySelector('#cricketer-layer-arms')).toBeInTheDocument()
    expect(container.querySelector('#cricketer-layer-bat')).toBeInTheDocument()
    expect(container.querySelector('.sold-motion-streak')).toBeInTheDocument()
  })

  it('contains NO unwanted text, prices, or team names', () => {
    const { container } = render(<SoldCelebration trigger={1} />)
    expect(container.textContent).toBe('')
    expect(screen.queryByText(/PLAYER SOLD/i)).toBeNull()
    expect(screen.queryByText(/CRORE/i)).toBeNull()
    expect(screen.queryByText(/LAKH/i)).toBeNull()
  })

  it('automatically completes and clears after the animation lifecycle (~2200ms)', () => {
    const onComplete = vi.fn()
    render(<SoldCelebration trigger={1} onComplete={onComplete} />)

    expect(screen.getByTestId('sold-celebration-overlay')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2200)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('sold-celebration-overlay')).toBeNull()
  })

  it('supports repeated triggers across consecutive player sales', () => {
    const { rerender } = render(<SoldCelebration trigger={1} />)
    expect(screen.getByTestId('sold-celebration-overlay')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2200)
    })
    expect(screen.queryByTestId('sold-celebration-overlay')).toBeNull()

    // Next player sold!
    rerender(<SoldCelebration trigger={2} />)
    expect(screen.getByTestId('sold-celebration-overlay')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2200)
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
