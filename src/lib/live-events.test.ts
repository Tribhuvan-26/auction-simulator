import { applyLiveEvent, newer } from './live-events'
import type { PublicSnapshot } from '@/app/admin/[roomId]/actions'

const lot = (currentBid: number) =>
  ({ id: 'lot-1', currentBid, currentBiddingTeamId: 'team-1' }) as unknown as PublicSnapshot['currentLot']

const snap = (at: number, over: Partial<PublicSnapshot> = {}) =>
  ({ at, room: { id: 'r', name: 'R', phase: 'LIVE', round: 1 }, currentLot: lot(20), teams: [], soldLog: [], resultLog: [], ...over }) as PublicSnapshot

it('a BID patches only the lot', () => {
  const prev = snap(1)
  const next = applyLiveEvent(prev, { type: 'BID', teamId: 'team-1', amount: 25, at: 2, lot: lot(25) })
  expect(next?.currentLot?.currentBid).toBe(25)
  expect(next?.teams).toBe(prev.teams)
  expect(next?.at).toBe(2)
})

it('other events replace the snapshot but keep fields they do not carry', () => {
  const prev = { ...snap(1), queue: ['kept'] }
  const next = applyLiveEvent(prev, { type: 'SOLD', at: 2, snapshot: snap(2, { currentLot: lot(90) }) })
  expect(next?.currentLot?.currentBid).toBe(90)
  expect(next?.queue).toEqual(['kept'])
})

it('ignores a broadcast older than what is on screen', () => {
  const prev = snap(5)
  expect(applyLiveEvent(prev, { type: 'BID', teamId: 't', amount: 25, at: 4, lot: lot(25) })).toBe(prev)
})

it('asks for a refetch when the event has no payload', () => {
  expect(applyLiveEvent(snap(1), { type: 'SOLD' } as never)).toBeNull()
})

it("an action's late result does not overwrite a newer broadcast", () => {
  const prev = snap(5, { currentLot: lot(30) })
  expect(newer(prev, snap(4, { currentLot: lot(25) }))).toBe(prev)
  expect(newer(prev, snap(6, { currentLot: lot(35) })).currentLot?.currentBid).toBe(35)
})
