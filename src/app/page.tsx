import { preload } from 'react-dom'
import { prisma } from '@/lib/prisma'
import { LandingExperience } from '@/components/ui/landing-experience'

// served from cache, refreshed in the background every 30s: no DB round trip per visitor
export const revalidate = 30

export default async function Home() {
  // the intro loader needs this before it can start; fetch it alongside the JS, not after
  preload('/assets/brand/ipl-loader.json', { as: 'fetch', crossOrigin: 'anonymous' })
  const rooms = await prisma.auctionRoom.findMany({
    include: {
      teams: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          shortCode: true,
          colorAccent: true,
          logoUrl: true,
        },
      },
      _count: { select: { players: true } },
    },
    orderBy: { name: 'asc' },
  })

  return <LandingExperience rooms={rooms} />
}

