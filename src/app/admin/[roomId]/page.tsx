import { getAdminSnapshot } from './actions'
import { hasAdminAccess } from '@/lib/team-auth'
import { unlockAdmin } from '@/lib/pin-actions'
import { PinGate } from '@/components/ui/pin-gate'
import { AdminConsole } from './admin-console'

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>
  searchParams: Promise<{ pin?: string }>
}) {
  const { roomId } = await params
  const initialSnapshot = await getAdminSnapshot(roomId)

  // The console raises bids for every team, so it can't be authorised by a team
  // seat — it has a PIN of its own, printed alongside the seats at seed time.
  if (!(await hasAdminAccess(roomId))) {
    const { pin } = await searchParams
    return (
      <PinGate
        title={initialSnapshot.room.name}
        accent="#2074D5"
        hint="Auctioneer's PIN — printed when the room was seeded."
        initialPin={(pin ?? '').replace(/\D/g, '').slice(0, 4)}
        unlock={unlockAdmin.bind(null, roomId)}
      />
    )
  }

  return <AdminConsole roomId={roomId} initialSnapshot={initialSnapshot} />
}
