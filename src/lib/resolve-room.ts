import { prisma } from '@/lib/prisma'

/**
 * Routes take the room's short `code` (e.g. "ROOM1"), not its real cuid —
 * resolve it once here so everything downstream (socket channel names,
 * cookie auth, foreign keys) keeps using the real id exactly as before.
 * Also accepts the cuid itself, since some UI links still build URLs from it.
 * Returns null for an unknown code so callers can 404 instead of erroring.
 */
export async function resolveRoomId(code: string): Promise<string | null> {
  const room = await prisma.auctionRoom.findFirst({ where: { OR: [{ code }, { id: code }] }, select: { id: true } })
  return room?.id ?? null
}
