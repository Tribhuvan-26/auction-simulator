import { io as ioClient, Socket } from 'socket.io-client'
import { createSocketServer } from './socket-server'
import type { Server as HttpServer } from 'http'
import type { AddressInfo } from 'net'

describe('socket-server', () => {
  let server: HttpServer
  let port: number
  let clientA: Socket
  let clientB: Socket

  beforeAll(async () => {
    server = createSocketServer(0)
    await new Promise<void>((resolve) => server.listen(() => resolve()))
    port = (server.address() as AddressInfo).port
  })

  afterAll(() => {
    clientA?.close()
    clientB?.close()
    server.close()
  })

  it('broadcasts auction:event only to other clients in the same room', async () => {
    clientA = ioClient(`http://localhost:${port}`)
    clientB = ioClient(`http://localhost:${port}`)

    await Promise.all([
      new Promise<void>((resolve) => clientA.on('connect', () => resolve())),
      new Promise<void>((resolve) => clientB.on('connect', () => resolve())),
    ])

    clientA.emit('room:join', 'room-1')
    clientB.emit('room:join', 'room-1')
    await new Promise((resolve) => setTimeout(resolve, 50))

    const received = new Promise((resolve) => clientB.on('auction:event', resolve))
    clientA.emit('auction:event', { roomId: 'room-1', payload: { type: 'BID', amount: 150 } })

    expect(await received).toEqual({ type: 'BID', amount: 150 })
  })
})
