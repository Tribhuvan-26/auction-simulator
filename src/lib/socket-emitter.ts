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

export function emitAuctionEvent(roomId: string, payload: unknown): Promise<void> {
  return new Promise((resolve) => {
    const s = getSocket()
    if (s.connected) {
      s.emit('auction:event', { roomId, payload })
      resolve()
    } else {
      s.once('connect', () => {
        s.emit('auction:event', { roomId, payload })
        resolve()
      })
    }
  })
}
