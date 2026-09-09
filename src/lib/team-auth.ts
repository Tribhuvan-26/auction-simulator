import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// One cookie per seat, so a phone can hold several seats at once (an operator
// checking two tables) without them overwriting each other.
export const teamCookieName = (teamId: string) => `team_${teamId}`

export const TEAM_COOKIE_MAX_AGE = 60 * 60 * 12 // an auction sitting

/**
 * Has this browser unlocked this team seat? The cookie holds the passcode
 * itself and is httpOnly, so it can't be read back out by page scripts.
 *
 * ponytail: passcode-in-cookie, no session table — a 4-digit PIN in a room
 * where everyone can see each other. Move to signed sessions (and rate-limit
 * the unlock) the moment this is reachable from outside the room.
 */
export async function hasTeamAccess(teamId: string): Promise<boolean> {
  const given = (await cookies()).get(teamCookieName(teamId))?.value
  if (!given) return false
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { passcode: true } })
  return team !== null && given === team.passcode
}
