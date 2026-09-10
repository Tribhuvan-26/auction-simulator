import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { SplitReveal } from './split-reveal'

// jsdom has no matchMedia, and SplitReveal treats a missing one as
// reduced-motion — which skips SplitText entirely and hides the bug this test
// covers. Report motion as allowed so the real split path runs.
beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList) as typeof window.matchMedia
})

describe('SplitReveal', () => {
  it('shows the new text when the player on the block changes', () => {
    // SplitText shreds the name into per-character nodes, so read the whole
    // container rather than looking for one text node.
    // SplitText also shifts where the space sits, so strip spaces entirely.
    const letters = (el: HTMLElement) => el.textContent?.replace(/\s+/g, '')
    const { container, rerender } = render(<SplitReveal text="Cooper Connolly" trigger="lot-1" />)
    expect(letters(container)).toBe('CooperConnolly')

    rerender(<SplitReveal text="Praveen Dubey" trigger="lot-2" />)
    expect(letters(container)).toBe('PraveenDubey')
  })
})
