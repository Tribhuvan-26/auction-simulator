import { notFound } from 'next/navigation'
import { getPublicSnapshot } from '@/app/admin/[roomId]/actions'
import { hasTeamAccess } from '@/lib/team-auth'
import { unlockTeam } from '@/lib/pin-actions'
import { PinGate } from '@/components/ui/pin-gate'
import { TeamConsole } from './team-console'

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string; teamId: string }>
  searchParams: Promise<{ pin?: string }>
}) {
  const { roomId, teamId } = await params
  const initialSnapshot = await getPublicSnapshot(roomId)
  const team = initialSnapshot.teams.find((t) => t.id === teamId)
  if (!team) notFound()

  // Nothing about this seat renders until the PIN is in. A ?pin= in the link
  // only prefills the box — the cookie is still set by the unlock action, so a
  // PIN shared in a URL can't be used without a round trip we can reject.
  if (!(await hasTeamAccess(teamId))) {
    const { pin } = await searchParams
    return (
      <PinGate
        title={team.name}
        accent={team.colorAccent}
        hint="The auctioneer has the PINs — ask at the desk."
        initialPin={(pin ?? '').replace(/\D/g, '').slice(0, 4)}
        unlock={unlockTeam.bind(null, roomId, teamId)}
      />
    )
  }

  return <TeamConsole roomId={roomId} teamId={teamId} initialSnapshot={initialSnapshot} />
}
