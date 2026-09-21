import { getPublicSnapshot, getRoomPlayers } from '@/app/admin/[roomId]/actions'
import { DisplayBoard } from './display-board'

export default async function DisplayPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const [initialSnapshot, roomPlayers] = await Promise.all([
    getPublicSnapshot(roomId),
    getRoomPlayers(roomId),
  ])
  return <DisplayBoard roomId={roomId} initialSnapshot={initialSnapshot} roomPlayers={roomPlayers} />
}

