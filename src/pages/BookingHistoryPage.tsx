import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useId, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  RESERVATION_HISTORY_QUERY_KEY,
  fetchReservations,
  type Reservation,
} from '@/api/reservations'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/components/cn'
import { describeLoadError, isSessionError, plural } from '@/pages/courts/format'
import { HistoryFiltersPanel } from '@/pages/history/HistoryFiltersPanel'
import {
  EMPTY_HISTORY_FILTERS,
  activeHistoryFilterCount,
  hasHistoryErrors,
  historyApiParams,
  historyFiltersToSearchParams,
  parseHistoryFilters,
  serverHistoryFilterErrors,
  validateHistoryFilters,
  type HistoryFilters,
} from '@/pages/history/historyFilters'
import { ReservationCard } from '@/pages/home/ReservationCard'
import { groupByMonth, type MonthGroup } from '@/pages/home/reservationFormat'
import { useNow } from '@/pages/home/useNow'

function uniqueById(reservations: Reservation[]): Reservation[] {
  const seen = new Set<string>()
  return reservations.filter((reservation) => {
    if (seen.has(reservation.id)) return false
    seen.add(reservation.id)
    return true
  })
}

/** Completed, cancelled and expired bookings — as booker or guest — newest first. */
export function BookingHistoryPage() {
  const navigate = useNavigate()
  const { refresh: refreshSession } = useAuth()
  const now = useNow()

  // Filters live in the URL, like the courts search.
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseHistoryFilters(searchParams), [searchParams])
  const setFilters = (next: HistoryFilters) =>
    setSearchParams(historyFiltersToSearchParams(next), { replace: true })
  const clearFilters = () => setFilters(EMPTY_HISTORY_FILTERS)

  const clientErrors = useMemo(() => validateHistoryFilters(filters), [filters])
  const filtersInvalid = hasHistoryErrors(clientErrors)
  const apiParams = useMemo(() => historyApiParams(filters), [filters])
  const filtered = activeHistoryFilterCount(filters) > 0

  const {
    data,
    error,
    isPending,
    isError,
    isFetching,
    isRefetching,
    isRefetchError,
    isFetchNextPageError,
    isFetchingNextPage,
    isPlaceholderData,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: [...RESERVATION_HISTORY_QUERY_KEY, apiParams],
    queryFn: ({ pageParam }) => fetchReservations(apiParams, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.next ? lastPageParam + 1 : undefined,
    enabled: !filtersInvalid,
    placeholderData: keepPreviousData,
  })

  const sessionExpired = isError && isSessionError(error)
  useEffect(() => {
    if (sessionExpired) void refreshSession()
  }, [sessionExpired, refreshSession])

  const reservations = useMemo(
    () => uniqueById(data?.pages.flatMap((page) => page.results) ?? []),
    [data],
  )
  const months = useMemo(() => groupByMonth(reservations), [reservations])
  const total = data?.pages.at(-1)?.count ?? reservations.length

  const serverErrors = filtersInvalid ? {} : serverHistoryFilterErrors(error)
  const fieldErrors = filtersInvalid ? clientErrors : serverErrors
  const rejectedByApi = !data && hasHistoryErrors(serverErrors)
  const updating = isPlaceholderData && isFetching
  const findCourt = () => navigate('/courts')

  let content
  if (filtersInvalid) {
    content = <Alert tone="info">Fix the highlighted filters to see your bookings.</Alert>
  } else if (isPending) {
    content = <Spinner label="Loading your booking history…" />
  } else if (rejectedByApi) {
    content = (
      <div className="space-y-4">
        <Alert>
          CourtControl couldn't use these filters. Adjust the highlighted ones.
        </Alert>
        <Button variant="secondary" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>
    )
  } else if (!data) {
    content = (
      <div className="space-y-4">
        <Alert>{describeLoadError(error, 'your booking history')}</Alert>
        <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? 'Retrying…' : 'Try again'}
        </Button>
      </div>
    )
  } else if (reservations.length === 0 && !updating) {
    content = filtered ? (
      <EmptyState
        title="No bookings match"
        description="Try other filters, or clear them to see your whole history."
        action={
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="No booking history yet"
        description="Bookings you've played, cancelled, or that expired unpaid show up here — including the ones other players added you to."
        action={<Button onClick={findCourt}>Find a court</Button>}
      />
    )
  } else {
    content = (
      <div className="space-y-8">
        {isRefetchError ? (
          <Alert>
            {describeLoadError(error, 'your booking history')} Showing the last loaded
            list.
          </Alert>
        ) : null}

        <div aria-live="polite">
          {updating ? (
            <Spinner label="Updating bookings…" />
          ) : (
            <p className="text-sm text-fog">
              {reservations.length < total
                ? `Showing ${reservations.length} of ${plural(total, 'booking')}`
                : plural(total, 'booking')}
            </p>
          )}
        </div>

        <div
          aria-busy={updating || undefined}
          className={cn('space-y-10 transition-opacity', updating && 'opacity-50')}
        >
          {months.map((month) => (
            <MonthSection key={month.key} month={month} now={now} />
          ))}
        </div>

        {isFetchNextPageError ? (
          <Alert>{describeLoadError(error, 'more bookings')}</Alert>
        ) : null}

        {hasNextPage && !updating ? (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage || isRefetching}
            >
              {isFetchingNextPage
                ? 'Loading more…'
                : isFetchNextPageError
                  ? 'Try loading more again'
                  : 'Load more bookings'}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Bookings"
        title="Booking history"
        description="Bookings you've played, cancelled, or that expired unpaid — as the booker or as a guest. Upcoming ones are on Home."
        actions={
          data && !filtersInvalid ? (
            <Button
              variant="secondary"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isRefetching && !isFetchingNextPage && !isPlaceholderData
                ? 'Refreshing…'
                : 'Refresh'}
            </Button>
          ) : null
        }
      />
      <div className="fade-up mx-auto mt-10 w-full max-w-3xl space-y-10 [animation-delay:120ms]">
        <HistoryFiltersPanel
          filters={filters}
          errors={fieldErrors}
          onChange={setFilters}
          onClear={clearFilters}
        />
        {content}
      </div>
    </>
  )
}

function MonthSection({ month, now }: { month: MonthGroup; now: number }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="font-display text-2xl tracking-tight text-line">
        {month.label}
      </h2>
      <ul className="space-y-3">
        {month.reservations.map((reservation) => (
          <li key={reservation.id}>
            <ReservationCard reservation={reservation} now={now} variant="history" />
          </li>
        ))}
      </ul>
    </section>
  )
}
