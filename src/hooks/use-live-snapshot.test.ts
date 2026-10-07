import { vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let onBroadcast: (msg: { payload: unknown }) => void = () => {}
vi.mock('@supabase/supabase-js', () => {
  const channel = {
    on: (_type: string, _filter: unknown, cb: typeof onBroadcast) => {
      onBroadcast = cb
      return channel
    },
    subscribe: () => channel,
  }
  return { createClient: () => ({ channel: () => channel, removeChannel: () => {} }) }
})

import { useLiveSnapshot } from './use-live-snapshot'

it('ignores a slow older refetch that lands after a newer one', async () => {
  const resolvers: ((v: string) => void)[] = []
  const fetchSnapshot = () => new Promise<string>((resolve) => resolvers.push(resolve))
  const { result } = renderHook(() => useLiveSnapshot('room-1', 'initial', fetchSnapshot))

  act(() => {
    onBroadcast({ payload: { type: 'BID' } })
    onBroadcast({ payload: { type: 'BID' } })
  })
  await act(async () => resolvers[1]('newer'))
  await act(async () => resolvers[0]('older'))

  expect(result.current.snapshot).toBe('newer')
})
