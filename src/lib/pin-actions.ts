'use server'

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { teamCookieName, adminCookieName, TEAM_COOKIE_MAX_AGE, seatToken } from '@/lib/team-auth'
import { callerKey, blockedFor, recordFailure, recordSuccess } from '@/lib/pin-rate-limit'

function blockedMessage(minutes: number) {
  return `Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

/**
 * Exchange a seat's PIN for its cookie. Returns an error message to show, or
 * null once the seat is unlocked.
 */
export async function unlockTeam(roomId: string, teamId: string, passcode: string): Promise<string | null> {
  // Per seat, not per IP: the whole venue shares one wifi IP, so one table's
  // typos must not lock every other table out.
  const key = `${await callerKey()}:team:${teamId}`
  const blocked = blockedFor(key)
  if (blocked) return blockedMessage(blocked)

  const team = await prisma.team.findFirst({
    where: { id: teamId, roomId },
    select: { passcode: true },
  })
  if (!team || passcode.trim() !== team.passcode) {
    const minutes = recordFailure(key)
    return minutes ? blockedMessage(minutes) : 'That PIN does not match this team seat.'
  }

  recordSuccess(key)
  ;(await cookies()).set(teamCookieName(teamId), seatToken('team', teamId, team.passcode), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TEAM_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })
  return null
}

/** Same exchange for the auctioneer's console, which is keyed by room. */
export async function unlockAdmin(roomId: string, passcode: string): Promise<string | null> {
  const key = `${await callerKey()}:admin:${roomId}`
  const blocked = blockedFor(key)
  if (blocked) return blockedMessage(blocked)

  const room = await prisma.auctionRoom.findUnique({
    where: { id: roomId },
    select: { adminPasscode: true },
  })
  if (!room || room.adminPasscode === '' || passcode.trim() !== room.adminPasscode) {
    const minutes = recordFailure(key)
    return minutes ? blockedMessage(minutes) : 'That PIN does not open this auction room.'
  }

  recordSuccess(key)
  ;(await cookies()).set(adminCookieName(roomId), seatToken('admin', roomId, room.adminPasscode), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TEAM_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })
  return null
}

/** Drops this browser's seat cookie; the page's PinGate takes over on refresh. */
export async function logoutTeam(teamId: string): Promise<void> {
  ;(await cookies()).delete(teamCookieName(teamId))
}

export async function logoutAdmin(roomId: string): Promise<void> {
  ;(await cookies()).delete(adminCookieName(roomId))
}
