import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Reservation } from '@/api/reservations'
import { BookingHistoryPage } from '@/pages/BookingHistoryPage'
import { makePlayer, makeReservation, makeReservationPage } from '@/test/factories'
import { jsonResponse, mockFetch, requestedUrls } from '@/test/fetch'
import { LocationProbe } from '@/test/LocationProbe'
import { currentSearch, freezeDate, renderWithProviders } from '@/test/render'

type User = ReturnType<typeof userEvent.setup>

const court = (name: string) => ({ ...makeReservation().court, name })

const completed = makeReservation({
  id: 'played',
  court: court('Court 1 - Guga'),
  state: 'completed',
  start: '2030-01-07T18:00:00-03:00',
  end: '2030-01-07T19:00:00-03:00',
  total_price: '120.00',
})
const cancelled = makeReservation({
  id: 'cancelled',
  court: court('Court 2 - Maria Esther'),
  state: 'cancelled',
  status: 'CANCELLED',
  start: '2030-01-05T09:00:00-03:00',
  end: '2030-01-05T10:00:00-03:00',
  cancelled_at: '2030-01-03T20:10:00-03:00',
  cancellation_reason: 'Rain forecast',
})
const asGuest = makeReservation({
  id: 'guest',
  court: court('Center Court'),
  role: 'guest',
  primary_player: makePlayer({ first_name: 'Carla', last_name: 'Costa' }),
  state: 'cancelled',
  status: 'CANCELLED',
  start: '2029-12-20T10:00:00-03:00',
  end: '2029-12-20T11:00:00-03:00',
  cancelled_at: '2029-12-19T08:00:00-03:00',
})
const expired = makeReservation({
  id: 'expired',
  court: court('Court 4 - Day Court'),
  state: 'expired',
  status: 'EXPIRED',
  start: '2029-12-10T07:00:00-03:00',
  end: '2029-12-10T08:00:00-03:00',
})

/** Fake CourtControl: GET /reservations/ answered by `respond` (default: the full history). */
function mockHistory(
  respond: (params: URLSearchParams) => Response | Promise<Response> = () =>
    jsonResponse(makeReservationPage([completed, cancelled, asGuest, expired])),
) {
  const fetchMock = mockFetch((url) => respond(url.searchParams))
  const lastParams = () =>
    new URLSearchParams(requestedUrls(fetchMock).at(-1)?.split('?')[1] ?? '')
  return { fetchMock, lastParams }
}

function renderPage(route = '/bookings') {
  return renderWithProviders(
    <>
      <BookingHistoryPage />
      <LocationProbe />
    </>,
    { route },
  )
}

const cards = () => screen.queryAllByRole('article')
const card = (name: RegExp) => screen.getByRole('article', { name })
/** Value under a card footer label ("Total", "Status"). */
const field = (container: HTMLElement, label: string) =>
  within(container).getByText(label, { selector: 'p' }).parentElement as HTMLElement
const pageSearch = () => currentSearch(screen.getByTestId)

async function pickDate(user: User, field: 'From' | 'To', isoDate: string) {
  await user.click(screen.getByRole('button', { name: field }))
  const calendar = screen.getByRole('dialog', { name: field })
  await user.click(within(calendar).getByRole('button', { name: isoDate }))
}

describe('Booking history', () => {
  beforeEach(() => freezeDate('2030-01-08T12:00:00-03:00'))

  it('asks for completed, cancelled and expired bookings, newest first', async () => {
    const { fetchMock } = mockHistory(() => new Promise<Response>(() => {}))

    renderPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Booking history' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading your booking history…')
    expect(requestedUrls(fetchMock)).toEqual([
      '/api/v1/reservations/?state=completed%2Ccancelled%2Cexpired&ordering=-start',
    ])
  })

  it('lists bookings by month, saying how each one ended', async () => {
    mockHistory()

    renderPage()

    await waitFor(() => expect(cards()).toHaveLength(4))
    expect(screen.getByText('4 bookings')).toBeInTheDocument()
    const months = screen
      .getAllByRole('region')
      .filter((region) => /20\d\d/.test(region.textContent ?? ''))
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Filters', 'January 2030', 'December 2029'])
    expect(months).toHaveLength(2)

    const played = card(/Court 1 - Guga/)
    expect(played).toHaveAccessibleName('Court 1 - Guga Yesterday 18:00–19:00 60 min')
    expect(field(played, 'Total')).toHaveTextContent('120.00')
    expect(field(played, 'Status')).toHaveTextContent('Completed')

    const mine = card(/Maria Esther/)
    expect(field(mine, 'Status')).toHaveTextContent('Cancelled')
    expect(
      within(mine).getByText('On Thu, Jan 3, 20:10 · “Rain forecast”'),
    ).toBeInTheDocument()

    const theirs = card(/Center Court/)
    expect(within(theirs).getByText('Guest')).toBeInTheDocument()
    expect(field(theirs, 'Status')).toHaveTextContent('Cancelled by the booking owner')
    // Older years say so.
    expect(theirs).toHaveAccessibleName(/Thu, Dec 20, 2029/)

    expect(field(card(/Day Court/), 'Status')).toHaveTextContent(
      "ExpiredIt wasn't paid in time, so the hold was released.",
    )
  })

  it('offers no cancelling or live badges in the history', async () => {
    mockHistory(() =>
      jsonResponse(
        makeReservationPage([
          // Even a cancelled future booking: it's history, not something to act on.
          makeReservation({ state: 'cancelled', status: 'CANCELLED', can_cancel: false }),
        ]),
      ),
    )

    renderPage()

    await waitFor(() => expect(cards()).toHaveLength(1))
    expect(
      screen.queryByRole('button', { name: /Cancel booking/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Cancellation')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Starts in|In progress|Awaiting payment/),
    ).not.toBeInTheDocument()
  })

  describe('filters', () => {
    it('filters by status, role and booking type, keeping them in the URL', async () => {
      const user = userEvent.setup()
      const { lastParams } = mockHistory()
      renderPage()
      await waitFor(() => expect(cards()).toHaveLength(4))

      await user.click(screen.getByRole('checkbox', { name: 'Cancelled' }))
      await waitFor(() => expect(lastParams().get('state')).toBe('cancelled'))

      await user.click(screen.getByRole('radio', { name: 'As a guest' }))
      await waitFor(() => expect(lastParams().get('role')).toBe('guest'))

      const typeGroup = screen.getByRole('group', { name: 'Booking type' })
      await user.click(within(typeGroup).getByRole('checkbox', { name: 'Doubles' }))
      await user.click(within(typeGroup).getByRole('checkbox', { name: 'Lesson' }))
      await waitFor(() => expect(lastParams().get('booking_type')).toBe('DOUBLES,LESSON'))

      expect(lastParams().get('ordering')).toBe('-start')
      expect(Object.fromEntries(pageSearch())).toEqual({
        status: 'cancelled',
        role: 'guest',
        type: 'DOUBLES,LESSON',
      })
      expect(screen.getByLabelText('3 active')).toBeInTheDocument()
    })

    it('filters by an open-ended or closed date range', async () => {
      const user = userEvent.setup()
      const { lastParams } = mockHistory()
      renderPage()
      await waitFor(() => expect(cards()).toHaveLength(4))

      await pickDate(user, 'From', '2030-01-02')
      await waitFor(() => expect(lastParams().get('date_from')).toBe('2030-01-02'))
      expect(lastParams().has('date_to')).toBe(false)

      await pickDate(user, 'To', '2030-01-07')
      await waitFor(() => expect(lastParams().get('date_to')).toBe('2030-01-07'))
      expect(pageSearch().get('from')).toBe('2030-01-02')

      // The "To" calendar can't go before "From".
      await user.click(screen.getByRole('button', { name: 'To' }))
      expect(
        within(screen.getByRole('dialog', { name: 'To' })).getByRole('button', {
          name: '2030-01-01',
        }),
      ).toBeDisabled()
    })

    it('applies filters from a link, ignoring values it cannot use', async () => {
      const { fetchMock } = mockHistory()

      renderPage(
        '/bookings?status=expired,upcoming&role=admin&type=singles&from=2029-12-01',
      )

      await screen.findAllByRole('article')
      expect(requestedUrls(fetchMock)[0]).toBe(
        '/api/v1/reservations/?state=expired&ordering=-start&booking_type=SINGLES&date_from=2029-12-01',
      )
      expect(screen.getByRole('checkbox', { name: 'Expired' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
      expect(screen.getByRole('button', { name: 'From' })).toHaveTextContent(
        'Sat, Dec 1, 2029',
      )
    })

    it('explains a reversed date range instead of asking the API', async () => {
      const { fetchMock } = mockHistory()

      renderPage('/bookings?from=2030-01-07&to=2030-01-01')

      expect(
        await screen.findByText('Must be on or after the start date.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'To' })).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Fix the highlighted filters to see your bookings.',
      )
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('shows API validation errors on the matching filter', async () => {
      const user = userEvent.setup()
      mockHistory((params) =>
        params.has('date_to')
          ? jsonResponse({ date_to: ['Must not be before `date_from`.'] }, 400)
          : jsonResponse(makeReservationPage([completed])),
      )

      renderPage('/bookings?to=2030-01-07')

      expect(await screen.findByText('Must not be before date_from.')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(
        "CourtControl couldn't use these filters",
      )

      await user.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!)
      await waitFor(() => expect(cards()).toHaveLength(1))
      expect(pageSearch().toString()).toBe('')
    })

    it('offers to clear filters when nothing matches', async () => {
      const user = userEvent.setup()
      mockHistory((params) =>
        params.get('booking_type')
          ? jsonResponse(makeReservationPage([]))
          : jsonResponse(makeReservationPage([completed])),
      )

      renderPage('/bookings?type=LESSON')

      expect(
        await screen.findByRole('heading', { name: 'No bookings match' }),
      ).toBeInTheDocument()
      await user.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!)

      await waitFor(() => expect(cards()).toHaveLength(1))
    })

    it('keeps the list on screen while new results load', async () => {
      const user = userEvent.setup()
      let release: (response: Response) => void = () => {}
      mockHistory((params) =>
        params.get('state') === 'completed'
          ? new Promise<Response>((resolve) => (release = resolve))
          : jsonResponse(makeReservationPage([completed, cancelled])),
      )
      renderPage()
      await waitFor(() => expect(cards()).toHaveLength(2))

      await user.click(screen.getByRole('checkbox', { name: 'Completed' }))

      expect(await screen.findByText('Updating bookings…')).toBeInTheDocument()
      expect(cards()).toHaveLength(2)
      release(jsonResponse(makeReservationPage([completed])))
      await waitFor(() => expect(cards()).toHaveLength(1))
    })
  })

  it('invites a first booking when there is no history at all', async () => {
    const user = userEvent.setup()
    mockHistory(() => jsonResponse(makeReservationPage([])))

    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'No booking history yet' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Find a court' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/courts')
  })

  it('loads more bookings page by page', async () => {
    const user = userEvent.setup()
    const older = (index: number): Reservation =>
      makeReservation({
        id: `old-${index}`,
        court: court(`Old court ${index}`),
        state: 'completed',
        start: '2029-11-10T10:00:00-03:00',
        end: '2029-11-10T11:00:00-03:00',
      })
    const { fetchMock } = mockHistory((params) =>
      params.get('page') === '2'
        ? jsonResponse(makeReservationPage([older(2)], { count: 3, page: 2 }))
        : jsonResponse(
            makeReservationPage([completed, older(1)], { count: 3, hasNext: true }),
          ),
    )

    renderPage()

    expect(await screen.findByText('Showing 2 of 3 bookings')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load more bookings' }))

    await waitFor(() => expect(cards()).toHaveLength(3))
    expect(screen.getByText('3 bookings')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Load more bookings' }),
    ).not.toBeInTheDocument()
    expect(requestedUrls(fetchMock).at(-1)).toContain('page=2')
    // Both older bookings share the November 2029 section.
    expect(
      within(screen.getByRole('region', { name: 'November 2029' })).getAllByRole(
        'article',
      ),
    ).toHaveLength(2)
  })

  describe('errors', () => {
    it('explains a failure and recovers on retry', async () => {
      const user = userEvent.setup()
      let fail = true
      mockHistory(() =>
        fail
          ? new Response('', { status: 500 })
          : jsonResponse(makeReservationPage([completed])),
      )

      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "CourtControl couldn't load your booking history right now (500). Try again in a moment.",
      )
      fail = false
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      await waitFor(() => expect(cards()).toHaveLength(1))
    })

    it('keeps the list when a refresh fails', async () => {
      const user = userEvent.setup()
      let fail = false
      mockHistory(() =>
        fail
          ? Promise.reject(new TypeError('Failed to fetch'))
          : jsonResponse(makeReservationPage([completed])),
      )
      renderPage()
      await waitFor(() => expect(cards()).toHaveLength(1))

      fail = true
      await user.click(screen.getByRole('button', { name: 'Refresh' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /showing the last loaded list/i,
      )
      expect(cards()).toHaveLength(1)
    })

    it('re-checks the session on a 403', async () => {
      mockHistory(() =>
        jsonResponse({ detail: 'Authentication credentials were not provided.' }, 403),
      )

      const { auth } = renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Your session has expired. Sign in again to see your booking history.',
      )
      await waitFor(() => expect(auth.refresh).toHaveBeenCalled())
    })
  })
})
