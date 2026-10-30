import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// One cookie per seat, so a phone can hold several seats at once (an operator
// checking two tables) without them overwriting each other.
export const teamCookieName = (teamId: string) => `team_${teamId}`
export const adminCookieName = (roomId: string) => `admin_${roomId}`

export const TEAM_COOKIE_MAX_AGE = 60 * 60 * 12 // an auction sitting

/**
 * What an unlocked seat's cookie holds: an HMAC of the seat and its PIN, never
 * the PIN itself. Guessing a cookie means guessing a 256-bit MAC, so the only
 * way in is the rate-limited unlock form. Changing a PIN logs its seat out.
 *
 * ponytail: falls back to DATABASE_URL as the key so deploys need no new env
 * var; set AUTH_SECRET to rotate sessions without touching the database.
 */
export function seatToken(kind: 'team' | 'admin', id: string, passcode: string): string {
  const key = process.env.AUTH_SECRET || process.env.DATABASE_URL
  if (!key) throw new Error('AUTH_SECRET or DATABASE_URL must be set to sign seat cookies')
  return createHmac('sha256', key).update(`${kind}:${id}:${passcode}`).digest('base64url')
}

function matches(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Has this browser unlocked this team seat? */
export async function hasTeamAccess(teamId: string): Promise<boolean> {
  const given = (await cookies()).get(teamCookieName(teamId))?.value
  if (!given) return false
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { passcode: true } })
  return team !== null && matches(given, seatToken('team', teamId, team.passcode))
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
  return room !== null && room.adminPasscode !== '' && matches(given, seatToken('admin', roomId, room.adminPasscode))
}

/**
 * The one thing a team seat can do: press I'M IN to claim a place in the lot.
 * The auctioneer can do it for any team.
 */
export async function assertCanClaimAs(roomId: string, teamId: string): Promise<void> {
  if (await hasTeamAccess(teamId)) return
  if (await hasAdminAccess(roomId)) return
  throw new Error('Unauthorized: take this team seat with its PIN first')
}

/**
 * The guard every other mutation in the admin actions file runs first. Bids
 * too: teams call out in the room and the auctioneer enters them.
 */
export async function assertIsAuctioneer(roomId: string): Promise<void> {
  if (await hasAdminAccess(roomId)) return
  throw new Error('Unauthorized: the admin console for this room is locked')
}
