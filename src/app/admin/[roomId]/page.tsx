import { getAdminSnapshot } from './actions'
import { AdminConsole } from './admin-console'

export default async function AdminPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const initialSnapshot = await getAdminSnapshot(roomId)
  return <AdminConsole roomId={roomId} initialSnapshot={initialSnapshot} />
}
