import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamGate } from './team-gate'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('./actions', () => ({ unlockTeam: vi.fn() }))

function renderGate(initialPin = '') {
  return render(
    <TeamGate
      roomId="r1"
      teamId="team-1"
      teamName="Delhi Capitals"
      colorAccent="#17479E"
      initialPin={initialPin}
    />
  )
}

describe('TeamGate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('will not submit until four digits are entered', () => {
    renderGate()
    const submit = screen.getByRole('button', { name: /take the seat/i })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/4-digit pin/i), { target: { value: '1234' } })
    expect(submit).not.toBeDisabled()
  })

  it('strips anything that is not a digit', () => {
    renderGate()
    const input = screen.getByLabelText(/4-digit pin/i)
    fireEvent.change(input, { target: { value: '12ab' } })
    expect(input).toHaveValue('12')
  })

  it('refreshes the page once the PIN is accepted', async () => {
    const { unlockTeam } = await import('./actions')
    vi.mocked(unlockTeam).mockResolvedValue(null)
    renderGate('4321')
    fireEvent.click(screen.getByRole('button', { name: /take the seat/i }))
    await vi.waitFor(() => expect(unlockTeam).toHaveBeenCalledWith('r1', 'team-1', '4321'))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('shows the rejection and stays locked on a wrong PIN', async () => {
    const { unlockTeam } = await import('./actions')
    vi.mocked(unlockTeam).mockResolvedValue('That PIN does not match this team seat.')
    renderGate('0000')
    fireEvent.click(screen.getByRole('button', { name: /take the seat/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/does not match/i)
    expect(refresh).not.toHaveBeenCalled()
  })
})
