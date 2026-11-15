import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { useEffect, useId, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  BOOKABLE_CLUBS_QUERY_KEY,
  COURTS_QUERY_KEY,
  fetchBookableClubs,
  fetchCourts,
  type ClubSummary,
  type Court,
  type CourtPage,
  type CourtTimeSlot,
} from '@/api/courts'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import type { SelectOption } from '@/components/Select'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/components/cn'
import { BookingModal, type BookingTarget } from '@/pages/courts/BookingModal'
import { CourtCard } from '@/pages/courts/CourtCard'
import { CourtFiltersPanel } from '@/pages/courts/CourtFiltersPanel'
import {
  EMPTY_FILTERS,
  activeFilterCount,
  describeWindow,
  filtersToSearchParams,
  hasErrors,
  hasWindow,
  parseFilters,
  serverFilterErrors,
  toApiParams,
  validateFilters,
  type CourtFilters,
} from '@/pages/courts/filters'
import {
  clubTimeZoneHint,
  courtCardId,
  describeCourtsError,
  groupCourtsByClub,
  isMembersOnly,
  isSessionError,
  plural,
  todayIn,
  uniqueCourts,
  type ClubGroup,
} from '@/pages/courts/format'

const unfilteredListKey = [...COURTS_QUERY_KEY, toApiParams(EMPTY_FILTERS)] as const

function clubsFromPages(pages: CourtPage[]): ClubSummary[] {
  const clubs = new Map<string, ClubSummary>()
  for (const page of pages)
    for (const court of page.results) clubs.set(court.club.id, court.club)
  return [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function CourtsPage() {
  const { refresh: refreshSession } = useAuth()
  const queryClient = useQueryClient()

  // Filters live in the URL: shareable, and they survive reloads / back-forward.
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])
  const setFilters = (next: CourtFilters) =>
    setSearchParams(filtersToSearchParams(next), { replace: true })
  const clearFilters = () => setFilters(EMPTY_FILTERS)

  // The slot being booked. The modal keeps its own copy of the court and slot,
  // so a list refresh after booking doesn't pull them away mid-flow.
  const [bookingTarget, setBookingTarget] = useState<BookingTarget | null>(null)
  const openBooking = (court: Court, slot: CourtTimeSlot) =>
    setBookingTarget({ court, slot })
  const closeBooking = () => {
    const courtId = bookingTarget?.court.id
    setBookingTarget(null)
    // The modal hands focus back to the slot that opened it — unless that slot
    // was just booked and left the list. Then land on the court's card instead.
    requestAnimationFrame(() => {
      const active = document.activeElement
      if (active && active !== document.body) return
      if (courtId) document.getElementById(courtCardId(courtId))?.focus()
    })
  }

  const today = todayIn()
  const clientErrors = useMemo(() => validateFilters(filters, today), [filters, today])
  const filtersInvalid = hasErrors(clientErrors)
  const apiParams = useMemo(() => toApiParams(filters), [filters])
  const filtered = activeFilterCount(filters) > 0

  const query = useInfiniteQuery({
    queryKey: [...COURTS_QUERY_KEY, apiParams],
    queryFn: ({ pageParam }) => fetchCourts(apiParams, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.next ? lastPageParam + 1 : undefined,
    // Don't ask for something the API will reject; the fields explain why.
    enabled: !filtersInvalid,
    // Keep the current list on screen while a new filter combination loads.
    placeholderData: keepPreviousData,
  })

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
  } = query

  // Club options load on demand (first time the menu opens, or a club is in the
  // URL). CourtControl has no club list: reuse the unfiltered court list when
  // it's fully loaded, otherwise walk it.
  const [clubsWanted, setClubsWanted] = useState(false)
  const clubsQuery = useQuery({
    queryKey: BOOKABLE_CLUBS_QUERY_KEY,
    queryFn: () => {
      const cached = queryClient.getQueryData<InfiniteData<CourtPage>>(unfilteredListKey)
      if (cached && cached.pages.at(-1)?.next === null)
        return clubsFromPages(cached.pages)
      return fetchBookableClubs()
    },
    enabled: clubsWanted || filters.clubs.length > 0,
    staleTime: 5 * 60_000,
  })
  const onClubsOpen = () => {
    setClubsWanted(true)
    if (clubsQuery.isError) void clubsQuery.refetch()
  }

  // A 401/403 means the session is gone: re-probe it so RequireAuth can send
  // the user back to the login screen.
  const sessionExpired = isError && isSessionError(error)
  useEffect(() => {
    if (sessionExpired) void refreshSession()
  }, [sessionExpired, refreshSession])

  const courts = useMemo(
    () => uniqueCourts(data?.pages.flatMap((page) => page.results) ?? []),
    [data],
  )
  const groups = useMemo(() => groupCourtsByClub(courts), [courts])
  const total = data?.pages.at(-1)?.count ?? courts.length

  const clubOptions: SelectOption[] = (clubsQuery.data ?? []).map((club) => ({
    value: club.id,
    label: club.name,
  }))
  // Name selected clubs from the results until the club list has loaded.
  const selectedClubOptions: SelectOption[] = groups
    .filter((group) => filters.clubs.includes(group.club.id))
    .map((group) => ({ value: group.club.id, label: group.club.name }))

  const serverErrors = filtersInvalid ? {} : serverFilterErrors(error)
  const fieldErrors = filtersInvalid ? clientErrors : serverErrors
  const rejectedByApi = !data && hasErrors(serverErrors)
  const windowSummary = describeWindow(filters, today)
  const updating = isPlaceholderData && isFetching

  const retry = () => void refetch()

  let content
  if (filtersInvalid) {
    content = <Alert tone="info">Fix the highlighted filters to see courts.</Alert>
  } else if (isPending) {
    content = <Spinner label="Loading courts…" />
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
        <Alert>{describeCourtsError(error)}</Alert>
        <Button variant="secondary" onClick={retry} disabled={isFetching}>
          {isFetching ? 'Retrying…' : 'Try again'}
        </Button>
      </div>
    )
  } else if (courts.length === 0 && !updating) {
    content = filtered ? (
      <EmptyState
        title="No courts match"
        description={
          hasWindow(filters)
            ? 'No court has a free slot in that window. Try another date or time, or clear some filters.'
            : 'Try other filters, or clear them to see every court you can book.'
        }
        action={
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="No courts to book"
        description="You can book courts at open clubs and at members-only clubs where your membership is active. None are available to you right now."
      />
    )
  } else {
    content = (
      <div className="space-y-10">
        {isRefetchError ? (
          <Alert>{describeCourtsError(error)} Showing the last loaded list.</Alert>
        ) : null}

        {/* Announce result counts as filters change, not the whole list. */}
        <div aria-live="polite" className="space-y-1">
          {updating ? (
            <Spinner label="Updating courts…" />
          ) : (
            <p className="text-sm text-fog">
              {courts.length < total
                ? `Showing ${courts.length} of ${plural(total, 'court')}`
                : `${plural(total, 'court')} across ${plural(groups.length, 'club')}`}
            </p>
          )}
          {windowSummary && !updating ? (
            <p className="text-sm text-fog">{windowSummary}</p>
          ) : null}
        </div>

        <div
          aria-busy={updating || undefined}
          className={cn('space-y-10 transition-opacity', updating && 'opacity-50')}
        >
          {groups.map((group) => (
            <ClubSection key={group.club.id} group={group} onBook={openBooking} />
          ))}
        </div>

        {isFetchNextPageError ? <Alert>{describeCourtsError(error)}</Alert> : null}

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
                  : 'Load more courts'}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Courts"
        title="Find a court"
        description="Courts you can book at open clubs and at clubs you're a member of, with their open slots."
        actions={
          data && !filtersInvalid ? (
            <Button variant="secondary" onClick={retry} disabled={isFetching}>
              {isRefetching && !isFetchingNextPage && !isPlaceholderData
                ? 'Refreshing…'
                : 'Refresh'}
            </Button>
          ) : null
        }
      />
      <div className="fade-up mx-auto mt-10 w-full max-w-3xl space-y-10 [animation-delay:120ms]">
        <CourtFiltersPanel
          filters={filters}
          errors={fieldErrors}
          today={today}
          clubOptions={clubOptions}
          selectedClubOptions={selectedClubOptions}
          clubsLoading={clubsQuery.isFetching && !clubsQuery.data}
          clubsError={clubsQuery.isError}
          onClubsOpen={onClubsOpen}
          onChange={setFilters}
          onClear={clearFilters}
        />
        {content}
      </div>
      <BookingModal target={bookingTarget} onClose={closeBooking} />
    </>
  )
}

function ClubSection({
  group,
  onBook,
}: {
  group: ClubGroup
  onBook: (court: Court, slot: CourtTimeSlot) => void
}) {
  const headingId = useId()
  const { club, courts } = group
  const timeZoneHint = clubTimeZoneHint(club)

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id={headingId} className="font-display text-2xl tracking-tight text-line">
          {club.name}
        </h2>
        <Badge tone="neutral">{isMembersOnly(club) ? 'Members only' : 'Open club'}</Badge>
        {timeZoneHint ? <span className="text-xs text-fog">{timeZoneHint}</span> : null}
      </div>
      <ul className="space-y-3">
        {courts.map((court) => (
          <li key={court.id}>
            <CourtCard court={court} onBook={onBook} />
          </li>
        ))}
      </ul>
    </section>
  )
}
