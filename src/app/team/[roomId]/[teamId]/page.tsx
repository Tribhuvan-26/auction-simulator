import { notFound } from 'next/navigation'
import { getAdminSnapshot } from '@/app/admin/[roomId]/actions'
import { hasTeamAccess } from '@/lib/team-auth'
import { TeamConsole } from './team-console'
import { TeamGate } from './team-gate'

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string; teamId: string }>
  searchParams: Promise<{ pin?: string }>
}) {
  const { roomId, teamId } = await params
  const initialSnapshot = await getAdminSnapshot(roomId)
  const team = initialSnapshot.teams.find((t) => t.id === teamId)
  if (!team) notFound()

  // Nothing about this seat renders until the PIN is in. A ?pin= in the link
  // only prefills the box — the cookie is still set by the unlock action, so a
  // PIN shared in a URL can't be used without a round trip we can reject.
  if (!(await hasTeamAccess(teamId))) {
    const { pin } = await searchParams
    return (
      <TeamGate
        roomId={roomId}
        teamId={teamId}
        teamName={team.name}
        colorAccent={team.colorAccent}
        initialPin={(pin ?? '').replace(/\D/g, '').slice(0, 4)}
      />
    )
  }

  return <TeamConsole roomId={roomId} teamId={teamId} initialSnapshot={initialSnapshot} />
}
