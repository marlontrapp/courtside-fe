import { PageHeader } from '@/components/PageHeader'
import { UpcomingReservations } from '@/pages/home/UpcomingReservations'

export function HomePage() {
  return (
    <>
      <PageHeader
        eyebrow="Courtside"
        title="You're in."
        description="Your next games are below. Use the side menu to find clubs, players, and courts."
      />
      <UpcomingReservations />
    </>
  )
}
