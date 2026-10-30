import { unstable_rethrow } from 'next/navigation'

/**
 * A server action that refuses (paused room, outbid, purse too small…) answers
 * with this instead of throwing: a production build replaces a thrown error's
 * message with a generic React error #441, so the console would never see why.
 */
export type Rejected = { rejected: string }

/** Server side: runs an action, turning a thrown refusal into a Rejected answer. */
export async function rejectable<T>(work: () => Promise<T>): Promise<T | Rejected> {
  try {
    return await work()
  } catch (e) {
    // redirect(), notFound() and friends work by throwing — let them through.
    unstable_rethrow(e)
    if (!(e instanceof Error)) throw e
    // Database failures carry internals, not something to show a bidder.
    if (e.name.startsWith('Prisma')) {
      console.error(e)
      return { rejected: 'Server error — try again' }
    }
    return { rejected: e.message }
  }
}

/** Client side: hands back the action's answer, or throws the refusal as an Error. */
export function unwrap<T>(result: T | Rejected): T {
  if (result && typeof result === 'object' && 'rejected' in result) throw new Error(result.rejected)
  return result as T
}
