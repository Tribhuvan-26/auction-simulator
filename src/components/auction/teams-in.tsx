import { TeamCrest } from '@/components/ui/team-crest'
import { MAX_ACTIVE_BIDDERS } from '@/lib/bid-rules'

type Team = { id: string; name: string; shortCode: string; colorAccent: string; logoUrl: string | null }

/**
 * The two teams contesting the lot, side by side, the leader marked — what the
 * auctioneer's TEAMS IN panel shows, for the big screen and the team seats.
 */
export function TeamsIn({
  teams,
  activeBidders,
  leaderId,
  size = 'sm',
}: {
  teams: Team[]
  activeBidders: string[]
  leaderId: string | null | undefined
  size?: 'sm' | 'lg'
}) {
  const inTeams = activeBidders
    .slice(0, MAX_ACTIVE_BIDDERS)
    .map((id) => teams.find((t) => t.id === id))
    .filter((t): t is Team => !!t)
  const lg = size === 'lg'

  if (inTeams.length === 0) {
    return (
      <span className={`font-condensed font-black uppercase text-white/50 ${lg ? 'text-[3.4vh]' : 'text-sm sm:text-base'}`}>
        Waiting for teams
      </span>
    )
  }

  return (
    <div data-testid="teams-in" className={`flex items-center ${lg ? 'gap-[1.5vh]' : 'gap-2'}`}>
      {inTeams.map((t, i) => {
        const leads = t.id === leaderId
        return (
          <div key={t.id} className={`flex min-w-0 items-center ${lg ? 'gap-[1.5vh]' : 'gap-2'}`}>
            {i > 0 && <span className={`font-mono font-black text-white/40 ${lg ? 'text-[2vh]' : 'text-[10px]'}`}>VS</span>}
            <div
              className={`flex min-w-0 items-center gap-1.5 border-2 ${lg ? 'px-[1.2vh] py-[0.4vh]' : 'px-1.5 py-0.5'}`}
              style={{ borderColor: leads ? '#F9CD05' : `${t.colorAccent}80`, background: `${t.colorAccent}26` }}
            >
              <TeamCrest
                shortCode={t.shortCode}
                name={t.name}
                colorAccent={t.colorAccent}
                logoUrl={t.logoUrl}
                mark
                className={lg ? 'h-[3.4vh] w-[3.4vh] shrink-0' : 'h-4 w-4 shrink-0'}
              />
              <span className={`font-condensed font-black uppercase leading-tight text-white ${lg ? 'text-[3.4vh]' : 'text-sm sm:text-base'}`}>
                {t.shortCode}
              </span>
              {leads && (
                <span className={`bg-[#F9CD05] font-mono font-black uppercase text-black ${lg ? 'px-[0.8vh] text-[1.5vh]' : 'px-1 text-[8px]'}`}>
                  LEADING
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
