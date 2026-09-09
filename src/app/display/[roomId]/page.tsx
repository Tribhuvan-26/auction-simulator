import { getPublicSnapshot } from '@/app/admin/[roomId]/actions'
import { DisplayBoard } from './display-board'

export default async function DisplayPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const initialSnapshot = await getPublicSnapshot(roomId)
  return <DisplayBoard roomId={roomId} initialSnapshot={initialSnapshot} />
}
