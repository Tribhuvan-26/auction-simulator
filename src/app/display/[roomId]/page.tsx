import { notFound } from 'next/navigation'
import { getPublicSnapshot } from '@/app/admin/[roomId]/actions'
import { resolveRoomId } from '@/lib/resolve-room'
import { DisplayBoard } from './display-board'

export default async function DisplayPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId: roomCode } = await params
  const roomId = await resolveRoomId(roomCode)
  if (!roomId) notFound()
  const initialSnapshot = await getPublicSnapshot(roomId)
  return <DisplayBoard roomId={roomId} initialSnapshot={initialSnapshot} />
}
