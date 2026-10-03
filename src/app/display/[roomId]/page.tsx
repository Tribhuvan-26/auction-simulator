import { getPublicSnapshot, getRoomPlayers } from '@/app/admin/[roomId]/actions'
import { notFound } from 'next/navigation'
import { resolveRoomId } from '@/lib/resolve-room'
import { DisplayBoard } from './display-board'

export default async function DisplayPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId: roomCode } = await params
  const roomId = await resolveRoomId(roomCode)
  if (!roomId) notFound()
  const [initialSnapshot, roomPlayers] = await Promise.all([
    getPublicSnapshot(roomId),
    getRoomPlayers(roomId),
  ])
  return <DisplayBoard roomId={roomId} initialSnapshot={initialSnapshot} roomPlayers={roomPlayers} />
}

