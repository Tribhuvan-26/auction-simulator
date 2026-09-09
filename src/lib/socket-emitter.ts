import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null
let testPort: number | null = null

// Test-only escape hatch so the integration test can point this singleton
// at an ephemeral test server instead of the real SOCKET_PORT.
export function __setSocketPortForTests(port: number | null) {
  testPort = port
  socket?.close()
  socket = null
}

function getSocket(): Socket {
  if (socket) return socket
  const url = testPort
    ? `http://localhost:${testPort}`
    : process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000'
  socket = io(url)
  return socket
}

const EMIT_TIMEOUT_MS = 3000

// Server actions call this after the DB write already succeeded, so a dead
// socket server must never throw or hang the mutation — it should just log
// and let the caller's return value (fresh DB state) stand on its own. Other
// connected clients will simply miss the live push until the socket server
// comes back, but nothing here should block the acting user.
export function emitAuctionEvent(roomId: string, payload: unknown): Promise<void> {
  return new Promise((resolve) => {
    const s = getSocket()

    if (s.connected) {
      s.emit('auction:event', { roomId, payload })
      resolve()
      return
    }

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      s.off('connect', onConnect)
      s.off('connect_error', onError)
      clearTimeout(timer)
      resolve()
    }

    const onConnect = () => {
      s.emit('auction:event', { roomId, payload })
      finish()
    }

    const onError = (err: Error) => {
      console.error(`[socket-emitter] connect_error, dropping event for room ${roomId}:`, err.message)
      finish()
    }

    const timer = setTimeout(() => {
      console.error(`[socket-emitter] timed out after ${EMIT_TIMEOUT_MS}ms waiting on socket server, dropping event for room ${roomId}`)
      finish()
    }, EMIT_TIMEOUT_MS)

    s.once('connect', onConnect)
    s.once('connect_error', onError)
  })
}
