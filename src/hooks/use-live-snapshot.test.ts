import { vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let onBroadcast: (msg: { payload: unknown }) => void = () => {}
let onStatus: (status: string) => void = () => {}
const created = vi.fn()
const removed = vi.fn()
vi.mock('@supabase/supabase-js', () => {
  const channel = {
    on: (_type: string, _filter: unknown, cb: typeof onBroadcast) => {
      onBroadcast = cb
      return channel
    },
    subscribe: (cb: typeof onStatus) => {
      onStatus = cb
      return channel
    },
  }
  return {
    createClient: () => ({
      channel: (topic: string) => (created(topic), channel),
      removeChannel: (c: unknown) => removed(c),
    }),
  }
})

import { useLiveSnapshot } from './use-live-snapshot'

// Channels are shared per room for the whole module, so each test gets its own.
let room = ''
let roomCount = 0
beforeEach(() => {
  room = `room-${++roomCount}`
  created.mockClear()
  removed.mockClear()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('ignores a slow older refetch that lands after a newer one', async () => {
  const resolvers: ((v: string) => void)[] = []
  const fetchSnapshot = () => new Promise<string>((resolve) => resolvers.push(resolve))
  const { result } = renderHook(() => useLiveSnapshot(room, 'initial', fetchSnapshot))

  act(() => {
    onBroadcast({ payload: { type: 'BID' } })
    onBroadcast({ payload: { type: 'BID' } })
  })
  await act(async () => resolvers[1]('newer'))
  await act(async () => resolvers[0]('older'))

  expect(result.current.snapshot).toBe('newer')
})

it('refetches when the channel (re)joins, so events missed while offline are caught up', async () => {
  const fetchSnapshot = vi.fn(async () => 'caught-up')
  const { result } = renderHook(() => useLiveSnapshot(room, 'initial', fetchSnapshot))

  await act(async () => onStatus('SUBSCRIBED'))

  expect(fetchSnapshot).toHaveBeenCalledWith(room)
  expect(result.current.snapshot).toBe('caught-up')
})

it('refetches when the tab comes back into view', async () => {
  const fetchSnapshot = vi.fn(async () => 'fresh')
  const { result } = renderHook(() => useLiveSnapshot(room, 'initial', fetchSnapshot))

  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
  })

  expect(result.current.snapshot).toBe('fresh')
})

it("a snapshot the caller sets wins over a refetch that started before it", async () => {
  let resolve: (v: string) => void = () => {}
  const fetchSnapshot = () => new Promise<string>((r) => (resolve = r))
  const { result } = renderHook(() => useLiveSnapshot(room, 'initial', fetchSnapshot))

  act(() => onBroadcast({ payload: { type: 'BID' } }))
  act(() => result.current.setSnapshot('from-action'))
  await act(async () => resolve('stale'))

  expect(result.current.snapshot).toBe('from-action')
})

it('polls instead of crashing when the Supabase env is missing', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const fetchSnapshot = vi.fn(async () => 'polled')
  const { result } = renderHook(() => useLiveSnapshot(room, 'initial', fetchSnapshot))

  await act(async () => vi.advanceTimersByTime(3000))

  expect(fetchSnapshot).toHaveBeenCalledTimes(1)
  expect(result.current.snapshot).toBe('polled')
})

it('applies the state carried by a broadcast without refetching', async () => {
  const fetchSnapshot = vi.fn(async () => 'refetched')
  const { result } = renderHook(() =>
    useLiveSnapshot(room, 'initial', fetchSnapshot, undefined, (_prev, e) => (e as unknown as { data: string }).data)
  )

  act(() => onBroadcast({ payload: { type: 'BID', data: 'from-message' } }))

  expect(result.current.snapshot).toBe('from-message')
  expect(fetchSnapshot).not.toHaveBeenCalled()
})

it('polls while the realtime channel is failing, and stops once it joins', async () => {
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const fetchSnapshot = vi.fn(async () => 'polled')
  renderHook(() => useLiveSnapshot(room, 'initial', fetchSnapshot))

  act(() => onStatus('CHANNEL_ERROR'))
  await act(async () => vi.advanceTimersByTime(3000))
  expect(fetchSnapshot).toHaveBeenCalledTimes(1)

  act(() => onStatus('SUBSCRIBED')) // one catch-up refetch, then no more polling
  await act(async () => vi.advanceTimersByTime(9000))
  expect(fetchSnapshot).toHaveBeenCalledTimes(2)
})

it('a CLOSED channel after unmount does not start polling', async () => {
  vi.useFakeTimers()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const fetchSnapshot = vi.fn(async () => 'x')
  const { unmount } = renderHook(() => useLiveSnapshot(room, 'initial', fetchSnapshot))

  unmount()
  act(() => onStatus('CLOSED'))
  await act(async () => vi.advanceTimersByTime(10_000))

  expect(fetchSnapshot).not.toHaveBeenCalled()
  expect(warn).not.toHaveBeenCalled()
})

it('a quick remount (React dev double-mount) reuses the live channel and still hears it', async () => {
  vi.useFakeTimers()
  const fetchSnapshot = vi.fn(async () => 'joined')
  renderHook(() => useLiveSnapshot(room, 'initial', fetchSnapshot)).unmount()
  const { result } = renderHook(() => useLiveSnapshot(room, 'initial', fetchSnapshot))

  await act(async () => onStatus('SUBSCRIBED'))
  await act(async () => vi.advanceTimersByTime(5000))

  expect(created).toHaveBeenCalledTimes(1)
  expect(removed).not.toHaveBeenCalled()
  expect(result.current.snapshot).toBe('joined')
})

it('closes the channel a moment after the last screen leaves', async () => {
  vi.useFakeTimers()
  renderHook(() => useLiveSnapshot(room, 'initial', async () => 'x')).unmount()
  await act(async () => vi.advanceTimersByTime(1000))
  expect(removed).toHaveBeenCalledTimes(1)
})

it('a refetch that lands after the room changed is dropped', async () => {
  let resolve: (v: string) => void = () => {}
  const fetchSnapshot = () => new Promise<string>((r) => (resolve = r))
  const other = `${room}-b`
  const { result, rerender } = renderHook(({ id }) => useLiveSnapshot(id, 'initial', fetchSnapshot), {
    initialProps: { id: room },
  })

  act(() => onBroadcast({ payload: { type: 'BID' } })) // refetch for the first room starts
  const stale = resolve
  rerender({ id: other })
  await act(async () => stale('first-room'))

  expect(result.current.snapshot).toBe('initial')
})

it('warns once when switching to polling, not on every reconnect attempt', async () => {
  vi.useFakeTimers()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  renderHook(() => useLiveSnapshot(room, 'initial', async () => 'x'))

  act(() => {
    onStatus('CHANNEL_ERROR')
    onStatus('TIMED_OUT')
    onStatus('CHANNEL_ERROR')
  })

  expect(warn).toHaveBeenCalledTimes(1)
})
