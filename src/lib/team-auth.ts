import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// One cookie per seat, so a phone can hold several seats at once (an operator
// checking two tables) without them overwriting each other.
export const teamCookieName = (teamId: string) => `team_${teamId}`
export const adminCookieName = (roomId: string) => `admin_${roomId}`

export const TEAM_COOKIE_MAX_AGE = 60 * 60 * 12 // an auction sitting

/**
 * Has this browser unlocked this team seat? The cookie holds the passcode
 * itself and is httpOnly, so it can't be read back out by page scripts.
 *
 * ponytail: passcode-in-cookie, no session table — a 4-digit PIN in a room
 * where everyone can see each other. Move to signed sessions the moment this
 * is reachable from outside the room.
 */
export async function hasTeamAccess(teamId: string): Promise<boolean> {
  const given = (await cookies()).get(teamCookieName(teamId))?.value
  if (!given) return false
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { passcode: true } })
  return team !== null && given === team.passcode
}

/**
 * Has this browser unlocked the auctioneer's console for this room? A room with
 * no admin PIN set (rooms seeded before the column existed) can't be unlocked
 * at all — reseed it rather than leaving the console open.
 */
export async function hasAdminAccess(roomId: string): Promise<boolean> {
  const given = (await cookies()).get(adminCookieName(roomId))?.value
  if (!given) return false
  const room = await prisma.auctionRoom.findUnique({
    where: { id: roomId },
    select: { adminPasscode: true },
  })
  return room !== null && room.adminPasscode !== '' && given === room.adminPasscode
}

/**
 * The guard every mutation in the admin actions file runs first. A bid is
 * authorised either by the seat it names or by the auctioneer, who raises on
 * behalf of whichever team called out. Everything else is auctioneer-only.
 */
export async function assertCanBidAs(roomId: string, teamId: string): Promise<void> {
  if (await hasTeamAccess(teamId)) return
  if (await hasAdminAccess(roomId)) return
  throw new Error('Unauthorized: take this team seat with its PIN before bidding')
}

export async function assertIsAuctioneer(roomId: string): Promise<void> {
  if (await hasAdminAccess(roomId)) return
  throw new Error('Unauthorized: the admin console for this room is locked')
}
