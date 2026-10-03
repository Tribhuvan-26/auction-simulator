const EMIT_TIMEOUT_MS = 3000

/** Channel name shared with useLiveSnapshot's subscription. */
export const roomChannel = (roomId: string) => `room:${roomId}`

// Server actions call this after the DB write already succeeded, so a Realtime
// outage must never throw or hang the mutation — it should just log and let the
// caller's return value (fresh DB state) stand on its own. Other clients simply
// miss the live push; nothing here should block the acting user.
export async function emitAuctionEvent(roomId: string, payload: unknown): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error(`[socket-emitter] Supabase env not set, dropping event for room ${roomId}`)
    return
  }
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ topic: roomChannel(roomId), event: 'auction:event', payload, private: false }],
      }),
      signal: AbortSignal.timeout(EMIT_TIMEOUT_MS),
    })
    if (!res.ok) console.error(`[socket-emitter] broadcast ${res.status}, dropping event for room ${roomId}`)
  } catch (err) {
    console.error(`[socket-emitter] broadcast failed, dropping event for room ${roomId}:`, (err as Error).message)
  }
}
