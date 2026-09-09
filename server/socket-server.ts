import { createServer } from 'http'
import { Server } from 'socket.io'

export function createSocketServer(port: number) {
  const httpServer = createServer()
  const io = new Server(httpServer, { cors: { origin: '*' } })

  io.on('connection', (socket) => {
    socket.on('room:join', (roomId: string) => {
      socket.join(roomId)
    })

    socket.on('auction:event', ({ roomId, payload }: { roomId: string; payload: unknown }) => {
      socket.to(roomId).emit('auction:event', payload)
    })
  })

  if (port > 0) httpServer.listen(port)
  return httpServer
}

if (require.main === module) {
  const port = Number(process.env.PORT || process.env.SOCKET_PORT) || 4000
  createSocketServer(port)
  console.log(`Socket.io server listening on port ${port}`)
}
