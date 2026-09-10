import { io as ioClient, Socket } from 'socket.io-client'
import { createSocketServer } from '../../server/socket-server'
import type { Server as HttpServer } from 'http'
import type { AddressInfo } from 'net'
import { emitAuctionEvent, __setSocketPortForTests } from './socket-emitter'

describe('socket-emitter', () => {
  let server: HttpServer
  let port: number
  let listener: Socket

  beforeAll(async () => {
    server = createSocketServer(0)
    await new Promise<void>((resolve) => server.listen(() => resolve()))
    port = (server.address() as AddressInfo).port
    __setSocketPortForTests(port)
  })

  afterAll(() => {
    listener?.close()
    server.close()
  })

  it('broadcasts a payload to clients in the target room', async () => {
    listener = ioClient(`http://localhost:${port}`)
    await new Promise<void>((resolve) => listener.on('connect', () => resolve()))
    listener.emit('room:join', 'room-1')
    await new Promise((resolve) => setTimeout(resolve, 50))

    const received = new Promise((resolve) => listener.on('auction:event', resolve))
    await emitAuctionEvent('room-1', { type: 'BID', teamId: 'team-1', amount: 150 })

    expect(await received).toEqual({ type: 'BID', teamId: 'team-1', amount: 150 })
  })
})
