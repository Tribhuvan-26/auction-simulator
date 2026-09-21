import { prisma } from '@/lib/prisma'
import { LandingExperience } from '@/components/ui/landing-experience'

export const dynamic = 'force-dynamic'

export default async function Home() {
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

