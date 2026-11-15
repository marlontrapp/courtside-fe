import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  UPCOMING_RESERVATIONS_QUERY_KEY,
  fetchUpcomingReservations,
  type Reservation,
} from '@/api/reservations'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Spinner } from '@/components/Spinner'
import {
  describeLoadError,
  inSentence,
  isSessionError,
  plural,
} from '@/pages/courts/format'
import { CancelReservationModal } from '@/pages/home/CancelReservationModal'
import { ReservationCard } from '@/pages/home/ReservationCard'
import {
  hasEnded,
  reservationDay,
  reservationTimeRange,
} from '@/pages/home/reservationFormat'
import { useNow } from '@/pages/home/useNow'

/** Reservations shown at first; "Show more" adds `SHOW_MORE_STEP` at a time. */
export const INITIAL_VISIBLE = 5
export const SHOW_MORE_STEP = 10

function uniqueById(reservations: Reservation[]): Reservation[] {
  const seen = new Set<string>()
  return reservations.filter((reservation) => {
    if (seen.has(reservation.id)) return false
    seen.add(reservation.id)
    return true
  })
}

/** Home section: the user's next bookings (as booker or guest), soonest first. */
export function UpcomingReservations() {
  const headingId = useId()
  const navigate = useNavigate()
  const { refresh: refreshSession } = useAuth()
  const now = useNow()
  const [visible, setVisible] = useState(INITIAL_VISIBLE)

  // Cancelling: the booking being confirmed, the ones CourtControl has cancelled
  // (hidden at once, before the refetch lands), and the last one for the notice.
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)
  const [cancelledIds, setCancelledIds] = useState<ReadonlySet<string>>(() => new Set())
  const [lastCancelled, setLastCancelled] = useState<Reservation | null>(null)
  const noticeRef = useRef<HTMLParagraphElement>(null)
  const onCancelled = (reservation: Reservation) => {
    setCancelledIds((ids) => new Set(ids).add(reservation.id))
    setLastCancelled(reservation)
    setCancelTarget(null)
  }
  // The card (and its button) is gone: move focus to the confirmation instead.
  useEffect(() => {
    if (lastCancelled) noticeRef.current?.focus()
  }, [lastCancelled])

  const {
    data,
    error,
    isPending,
    isError,
    isFetching,
    isFetchNextPageError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: UPCOMING_RESERVATIONS_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchUpcomingReservations(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.next ? lastPageParam + 1 : undefined,
  })

  const sessionExpired = isError && isSessionError(error)
  useEffect(() => {
    if (sessionExpired) void refreshSession()
  }, [sessionExpired, refreshSession])

  const loaded = useMemo(
    () => uniqueById(data?.pages.flatMap((page) => page.results) ?? []),
    [data],
  )
  // Bookings that finished while the page was open drop out without a refetch.
  const reservations = loaded.filter(
    (reservation) => !hasEnded(reservation, now) && !cancelledIds.has(reservation.id),
  )
  const ended = loaded.length - reservations.length
  const total = Math.max((data?.pages.at(-1)?.count ?? 0) - ended, reservations.length)
  const shown = reservations.slice(0, visible)

  const showMore = () => {
    const next = visible + SHOW_MORE_STEP
    setVisible(next)
    if (next > reservations.length && hasNextPage && !isFetchingNextPage)
      void fetchNextPage()
  }
  const findCourt = () => navigate('/courts')

  let content
  if (isPending) {
    content = <Spinner label="Loading your reservations…" />
  } else if (!data) {
    content = (
      <div className="space-y-4">
        <Alert>{describeLoadError(error, 'your reservations')}</Alert>
        <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? 'Retrying…' : 'Try again'}
        </Button>
      </div>
    )
  } else if (reservations.length === 0) {
    content = (
      <EmptyState
        title="No upcoming reservations"
        description="Book a court and it will show up here — so will bookings other players add you to."
        action={<Button onClick={findCourt}>Find a court</Button>}
      />
    )
  } else {
    const hiddenCount = total - shown.length
    content = (
      <div className="space-y-4">
        <ul className="space-y-3">
          {shown.map((reservation) => (
            <li key={reservation.id}>
              <ReservationCard
                reservation={reservation}
                now={now}
                onCancel={setCancelTarget}
              />
            </li>
          ))}
        </ul>

        {isFetchNextPageError ? (
          <Alert>{describeLoadError(error, 'more reservations')}</Alert>
        ) : null}

        {hiddenCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fog">
              Showing {shown.length} of {plural(total, 'reservation')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={showMore}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage
                ? 'Loading…'
                : `Show ${Math.min(SHOW_MORE_STEP, hiddenCount)} more`}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <section
      aria-labelledby={headingId}
      className="fade-up mx-auto mt-12 w-full max-w-3xl space-y-5 [animation-delay:120ms]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 id={headingId} className="font-display text-2xl tracking-tight text-line">
            Upcoming reservations
          </h2>
          {reservations.length > 0 ? (
            <Badge tone="accent" aria-label={plural(total, 'upcoming reservation')}>
              {total}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/bookings')}>
            Booking history
          </Button>
          {reservations.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={findCourt}>
              Book another court
            </Button>
          ) : null}
        </div>
      </div>
      {lastCancelled ? (
        <Alert tone="success" ref={noticeRef} tabIndex={-1} className="outline-none">
          Booking cancelled: {lastCancelled.court.name},{' '}
          {inSentence(reservationDay(lastCancelled))}{' '}
          {reservationTimeRange(lastCancelled)}.
        </Alert>
      ) : null}
      {content}
      <CancelReservationModal
        reservation={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={onCancelled}
      />
    </section>
  )
}
