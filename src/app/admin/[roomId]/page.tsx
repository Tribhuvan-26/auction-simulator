import { notFound } from 'next/navigation'
import { getAdminSnapshot } from './actions'
import { hasAdminAccess } from '@/lib/team-auth'
import { unlockAdmin } from '@/lib/pin-actions'
import { resolveRoomId } from '@/lib/resolve-room'
import { prisma } from '@/lib/prisma'
import { PinGate } from '@/components/ui/pin-gate'
import { AdminConsole } from './admin-console'

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>
  searchParams: Promise<{ pin?: string }>
}) {
  const { roomId: roomCode } = await params
  const roomId = await resolveRoomId(roomCode)
  if (!roomId) notFound()

  // The console raises bids for every team, so it can't be authorised by a team
  // seat — it has a PIN of its own, printed alongside the seats at seed time.
  // Checked before loading the snapshot: the queue is for the auctioneer only.
  if (!(await hasAdminAccess(roomId))) {
    const { pin } = await searchParams
    const room = await prisma.auctionRoom.findUniqueOrThrow({ where: { id: roomId }, select: { name: true } })
    return (
      <PinGate
        title={room.name}
        accent="#2074D5"
        hint="Auctioneer's PIN — printed when the room was seeded."
        initialPin={(pin ?? '').replace(/\D/g, '').slice(0, 4)}
        unlock={unlockAdmin.bind(null, roomId)}
      />
    )
  }

  return <AdminConsole roomId={roomId} initialSnapshot={await getAdminSnapshot(roomId)} />
}
