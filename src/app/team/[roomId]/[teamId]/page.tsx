import { notFound } from 'next/navigation'
import { getAdminSnapshot } from '@/app/admin/[roomId]/actions'
import { TeamConsole } from './team-console'

export default async function TeamPage({
  params,
}: {
  params: Promise<{ roomId: string; teamId: string }>
}) {
  const { roomId, teamId } = await params
  const initialSnapshot = await getAdminSnapshot(roomId)
  if (!initialSnapshot.teams.some((t) => t.id === teamId)) notFound()
  return <TeamConsole roomId={roomId} teamId={teamId} initialSnapshot={initialSnapshot} />
}
