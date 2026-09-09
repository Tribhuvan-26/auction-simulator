'use server'

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { teamCookieName, TEAM_COOKIE_MAX_AGE } from '@/lib/team-auth'

/**
 * Exchange a seat's PIN for its cookie. Returns an error message to show, or
 * null once the seat is unlocked.
 */
export async function unlockTeam(roomId: string, teamId: string, passcode: string): Promise<string | null> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, roomId },
    select: { passcode: true },
  })
  if (!team || passcode.trim() !== team.passcode) return 'That PIN does not match this team seat.'

  ;(await cookies()).set(teamCookieName(teamId), team.passcode, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/team',
    maxAge: TEAM_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })
  return null
}
