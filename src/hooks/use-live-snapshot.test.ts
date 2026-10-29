import { vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

type FakeChannel = {
  topic: string
  broadcast: (msg: { payload: unknown }) => void
  status: (status: string) => void
}

// A fake realtime client that behaves like realtime-js where it matters: each
// channel() is a new channel unless one for that topic is still in the list,
// and a removed channel only leaves the list once its unsubscribe settles.
const rt = vi.hoisted(() => ({
  channels: [] as FakeChannel[],
  created: [] as FakeChannel[],
  removed: [] as FakeChannel[],
  removal: null as Promise<void> | null,
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    channel: (topic: string) => {
      const existing = rt.channels.find((c) => c.topic === `realtime:${topic}`)
      if (existing) return existing
      const ch = { topic: `realtime:${topic}` } as FakeChannel & Record<string, unknown>
      ch.on = (_t: string, _f: unknown, cb: FakeChannel['broadcast']) => ((ch.broadcast = cb), ch)
      ch.subscribe = (cb: FakeChannel['status']) => ((ch.status = cb), ch)
      rt.channels.push(ch)
      rt.created.push(ch)
      return ch
    },
    getChannels: () => rt.channels,
    removeChannel: async (ch: FakeChannel) => {
      rt.removed.push(ch)
      await rt.removal
      rt.channels = rt.channels.filter((c) => c !== ch)
      return 'ok'
    },
  }),
}))

import { useLiveSnapshot } from './use-live-snapshot'

const last = () => rt.created[rt.created.length - 1]
const onBroadcast = (msg: { payload: unknown }) => last().broadcast(msg)
const onStatus = (status: string) => last().status(status)

// Channels are shared per room for the whole module, so each test gets its own.
let room = ''
let roomCount = 0
beforeEach(() => {
  room = `room-${++roomCount}`
  rt.created = []
  rt.removed = []
  rt.removal = null
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

it('a snapshot the caller sets wins over a refetch that started before it', async () => {
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
    useLiveSnapshot(room, 'initial', fetchSnapshot, { applyEvent: (_prev, e) => (e as unknown as { data: string }).data })
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

  expect(rt.created).toHaveLength(1)
  expect(rt.removed).toHaveLength(0)
  expect(result.current.snapshot).toBe('joined')
})

it('closes the channel a moment after the last screen leaves', async () => {
  vi.useFakeTimers()
  renderHook(() => useLiveSnapshot(room, 'initial', async () => 'x')).unmount()
  await act(async () => vi.advanceTimersByTime(1000))
  expect(rt.removed).toHaveLength(1)
})

it('coming back while the old channel is still closing waits for it, then opens a fresh one', async () => {
  vi.useFakeTimers()
  let finishRemoval: () => void = () => {}
  rt.removal = new Promise<void>((r) => (finishRemoval = r))
  renderHook(() => useLiveSnapshot(room, 'initial', async () => 'x')).unmount()
  await act(async () => vi.advanceTimersByTime(1000)) // linger over: removal starts, still in flight

  const fetchSnapshot = vi.fn(async () => 'live')
  const { result } = renderHook(() => useLiveSnapshot(room, 'initial', fetchSnapshot))
  expect(rt.created).toHaveLength(1) // not handed the closing channel

  await act(async () => finishRemoval())
  expect(rt.created).toHaveLength(2)
  await act(async () => onStatus('SUBSCRIBED'))
  expect(result.current.snapshot).toBe('live')
})

it('a server-side CLOSED makes screens poll, then rejoins on a new channel', async () => {
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const fetchSnapshot = vi.fn(async () => 'x')
  renderHook(() => useLiveSnapshot(room, 'initial', fetchSnapshot))
  const first = last()

  act(() => first.status('CLOSED'))
  await act(async () => vi.advanceTimersByTime(3000))
  expect(fetchSnapshot).toHaveBeenCalledTimes(1) // polling

  await act(async () => vi.advanceTimersByTime(10_000))
  expect(last()).not.toBe(first)
  await act(async () => onStatus('SUBSCRIBED'))
  const calls = fetchSnapshot.mock.calls.length
  await act(async () => vi.advanceTimersByTime(9000))
  expect(fetchSnapshot).toHaveBeenCalledTimes(calls) // polling stopped
})

it("one screen's failing handler doesn't stop the others in the room hearing a broadcast", () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  renderHook(() =>
    useLiveSnapshot(room, 'a', async () => 'a', {
      onEvent: () => {
        throw new Error('boom')
      },
    })
  )
  const { result } = renderHook(() => useLiveSnapshot(room, 'b', async () => 'b', { applyEvent: () => 'heard' }))

  act(() => onBroadcast({ payload: { type: 'BID' } }))

  expect(result.current.snapshot).toBe('heard')
})

it('a refetch that lands after the room changed is dropped', async () => {
  let resolve: (v: string) => void = () => {}
  const fetchSnapshot = () => new Promise<string>((r) => (resolve = r))
  const { result, rerender } = renderHook(({ id }) => useLiveSnapshot(id, 'initial', fetchSnapshot), {
    initialProps: { id: room },
  })

  act(() => onBroadcast({ payload: { type: 'BID' } })) // refetch for the first room starts
  const stale = resolve
  rerender({ id: `${room}-b` })
  await act(async () => stale('first-room'))

  expect(result.current.snapshot).toBe('initial')
})

it('warns once when switching to polling, not on every reconnect attempt', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  renderHook(() => useLiveSnapshot(room, 'initial', async () => 'x'))

  act(() => {
    onStatus('CHANNEL_ERROR')
    onStatus('TIMED_OUT')
    onStatus('CHANNEL_ERROR')
  })

  expect(warn).toHaveBeenCalledTimes(1)
})

describe('with versioned snapshots', () => {
  type S = { at: number; v: string }
  const versionOf = (s: S) => s.at

  it("a stale or echoed broadcast doesn't cancel the catch-up refetch", async () => {
    let resolve: (v: S) => void = () => {}
    const fetchSnapshot = () => new Promise<S>((r) => (resolve = r))
    const { result } = renderHook(() =>
      useLiveSnapshot(room, { at: 5, v: 'initial' }, fetchSnapshot, { versionOf, applyEvent: (prev) => prev })
    )

    act(() => onStatus('SUBSCRIBED')) // catch-up refetch in flight
    act(() => onBroadcast({ payload: { type: 'BID' } })) // nothing new
    await act(async () => resolve({ at: 9, v: 'caught-up' }))

    expect(result.current.snapshot.v).toBe('caught-up')
  })

  it('a refetch older than a broadcast that landed meanwhile is read again, not lost', async () => {
    const resolvers: ((v: S) => void)[] = []
    const fetchSnapshot = vi.fn(() => new Promise<S>((r) => resolvers.push(r)))
    const { result } = renderHook(() =>
      useLiveSnapshot(room, { at: 1, v: 'initial' }, fetchSnapshot, {
        versionOf,
        applyEvent: (prev) => ({ ...prev, at: 7, v: 'bid' }),
      })
    )

    act(() => onStatus('SUBSCRIBED'))
    act(() => onBroadcast({ payload: { type: 'BID' } }))
    await act(async () => resolvers[0]({ at: 5, v: 'older-read' }))
    expect(fetchSnapshot).toHaveBeenCalledTimes(2)
    await act(async () => resolvers[1]({ at: 8, v: 'second-read' }))

    expect(result.current.snapshot.v).toBe('second-read')
  })
})
