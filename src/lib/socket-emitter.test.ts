import { vi } from 'vitest'
import { emitAuctionEvent } from './socket-emitter'

describe('socket-emitter', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('broadcasts the payload on the room channel', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)

    await emitAuctionEvent('room-1', { type: 'BID', teamId: 'team-1', amount: 150 })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://proj.supabase.co/realtime/v1/api/broadcast')
    expect(JSON.parse(init.body as string)).toEqual({
      messages: [
        { topic: 'room:room-1', event: 'auction:event', payload: { type: 'BID', teamId: 'team-1', amount: 150 }, private: false },
      ],
    })
  })

  it('never throws when Realtime is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    await expect(emitAuctionEvent('room-1', {})).resolves.toBeUndefined()
  })
})
