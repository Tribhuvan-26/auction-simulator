import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PinGate } from './pin-gate'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

function renderGate(unlock: (pin: string) => Promise<string | null>, initialPin = '') {
  return render(
    <PinGate title="Delhi Capitals" accent="#17479E" hint="Ask at the desk." initialPin={initialPin} unlock={unlock} />
  )
}

describe('PinGate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('will not submit until four digits are entered', () => {
    renderGate(vi.fn())
    const submit = screen.getByRole('button', { name: /unlock/i })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/4-digit pin/i), { target: { value: '1234' } })
    expect(submit).not.toBeDisabled()
  })

  it('strips anything that is not a digit', () => {
    renderGate(vi.fn())
    const input = screen.getByLabelText(/4-digit pin/i)
    fireEvent.change(input, { target: { value: '12ab' } })
    expect(input).toHaveValue('12')
  })

  it('refreshes the page once the PIN is accepted', async () => {
    const unlock = vi.fn().mockResolvedValue(null)
    renderGate(unlock, '4321')
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    await vi.waitFor(() => expect(unlock).toHaveBeenCalledWith('4321'))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('recovers from a network failure instead of sticking on verifying', async () => {
    renderGate(vi.fn().mockRejectedValue(new Error('fetch failed')), '1234')
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i)
    expect(screen.getByRole('button', { name: /unlock/i })).not.toBeDisabled()
  })

  it('shows the rejection and stays locked on a wrong PIN', async () => {
    renderGate(vi.fn().mockResolvedValue('That PIN does not match this team seat.'), '0000')
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/does not match/i)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('shows the lockout message when the limiter trips', async () => {
    renderGate(vi.fn().mockResolvedValue('Too many wrong PINs. Try again in 15 minutes.'), '0000')
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/15 minutes/i)
  })
})
