import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Reservation } from '@/api/reservations'
import { HomePage } from '@/pages/HomePage'
import { makePlayer, makeReservation, makeReservationPage } from '@/test/factories'
import { jsonResponse, mockFetch, requestedUrls } from '@/test/fetch'
import { LocationProbe } from '@/test/LocationProbe'
import { freezeDate, renderWithProviders } from '@/test/render'

function renderHome() {
  return renderWithProviders(
    <>
      <HomePage />
      <LocationProbe />
    </>,
  )
}

const section = () => screen.getByRole('region', { name: 'Upcoming reservations' })
const cards = () => within(section()).queryAllByRole('article')
const card = (name: string | RegExp) => within(section()).getByRole('article', { name })
/** Value under a card footer label ("Total", "Cancellation"). */
const field = (container: HTMLElement, label: string) =>
  within(container).getByText(label, { selector: 'p' }).nextElementSibling as HTMLElement

/** n reservations an hour apart, starting tomorrow 08:00. */
function series(n: number, offset = 0): Reservation[] {
  return Array.from({ length: n }, (_, index) => {
    const hour = String(8 + ((index + offset) % 14)).padStart(2, '0')
    const day = 9 + Math.floor((index + offset) / 14)
    return makeReservation({
      id: `r-${index + offset}`,
      court: {
        id: 'court-guga',
        name: `Court ${index + offset + 1}`,
        club: {
          id: 'club-ibirapuera',
          name: 'Ibirapuera Tennis Center',
          timezone: 'America/Sao_Paulo',
        },
      },
      start: `2030-01-${day}T${hour}:00:00-03:00`,
      end: `2030-01-${day}T${hour}:59:00-03:00`,
    })
  })
}

describe('Home · upcoming reservations', () => {
  beforeEach(() => freezeDate('2030-01-08T12:00:00-03:00'))

  it('asks for unfinished bookings soonest first, showing a loading state', async () => {
    const fetchMock = mockFetch(() => new Promise<Response>(() => {}))

    renderHome()

    expect(
      screen.getByRole('heading', { level: 1, name: "You're in." }),
    ).toBeInTheDocument()
    expect(within(section()).getByRole('status')).toHaveTextContent(
      'Loading your reservations…',
    )
    expect(requestedUrls(fetchMock)).toEqual([
      '/api/v1/reservations/?state=upcoming%2Cpending_payment&ordering=start',
    ])
  })

  it('shows when, where and with whom for each booking', async () => {
    mockFetch(() =>
      jsonResponse(
        makeReservationPage([
          makeReservation({
            booking_type: 'DOUBLES',
            includes_lighting: true,
            guests: [
              makePlayer({ first_name: 'Ana', last_name: 'Silva' }),
              makePlayer({ first_name: 'Bruno', last_name: 'Lima' }),
            ],
            notes: 'Bring balls',
            total_price: '300.00',
            start: '2030-01-09T18:00:00-03:00',
            end: '2030-01-09T20:00:00-03:00',
            cancellation_deadline: '2030-01-08T18:00:00-03:00',
          }),
        ]),
      ),
    )

    renderHome()

    const booking = await within(section()).findByRole('article', {
      name: 'Court 1 - Guga Tomorrow 18:00–20:00 2 h',
    })
    expect(within(booking).getByText('Ibirapuera Tennis Center')).toBeInTheDocument()
    expect(
      within(booking).getByText(
        'Doubles · Lighting · With Ana Silva, Bruno Lima',
      ),
    ).toBeInTheDocument()
    expect(within(booking).getByText('“Bring balls”')).toBeInTheDocument()
    // Footer: a labelled total, and the cancellation status with its deadline.
    expect(field(booking, 'Total')).toHaveTextContent('300.00')
    expect(field(booking, 'Cancellation')).toHaveTextContent('Free until today, 18:00')
    expect(within(booking).getByRole('separator')).toBeInTheDocument()
    expect(within(section()).getByLabelText('1 upcoming reservation')).toHaveTextContent(
      '1',
    )
  })

  it('marks bookings the user was added to, unpaid holds, and closed cancellation windows', async () => {
    mockFetch(() =>
      jsonResponse(
        makeReservationPage([
          makeReservation({
            id: 'as-guest',
            court: { ...makeReservation().court, name: 'Guest court' },
            role: 'guest',
            primary_player: makePlayer({ first_name: 'Carla', last_name: 'Costa' }),
            guests: [makePlayer({ first_name: 'Pat', last_name: 'Player' })],
            can_cancel: false,
          }),
          makeReservation({
            id: 'hold',
            court: { ...makeReservation().court, name: 'Hold court' },
            state: 'pending_payment',
            status: 'PENDING_PAYMENT',
          }),
          makeReservation({
            id: 'locked',
            court: { ...makeReservation().court, name: 'Locked court' },
            can_cancel: false,
          }),
        ]),
      ),
    )

    renderHome()

    const guest = await within(section()).findByRole('article', { name: /Guest court/ })
    expect(within(guest).getByText('Guest')).toBeInTheDocument()
    expect(
      within(guest).getByText('Singles · Booked by Carla Costa'),
    ).toBeInTheDocument()
    expect(
      within(guest).getByText(
        "Guests can't cancel a booking. Ask the booking owner to cancel it.",
      ),
    ).toBeInTheDocument()

    const hold = card(/Hold court/)
    expect(within(hold).getByText('Awaiting payment')).toBeInTheDocument()
    expect(field(hold, 'Cancellation')).toHaveTextContent('Free until it starts')

    expect(
      within(card(/Locked court/)).getByText(
        "The club doesn't permit cancellations within 24 hours of the start of the booking.",
      ),
    ).toBeInTheDocument()
  })

  it('flags bookings in progress or starting within the hour', async () => {
    mockFetch(() =>
      jsonResponse(
        makeReservationPage([
          makeReservation({
            id: 'now',
            court: { ...makeReservation().court, name: 'Playing now' },
            start: '2030-01-08T11:30:00-03:00',
            end: '2030-01-08T12:30:00-03:00',
          }),
          makeReservation({
            id: 'soon',
            court: { ...makeReservation().court, name: 'Up next' },
            start: '2030-01-08T12:25:00-03:00',
            end: '2030-01-08T13:25:00-03:00',
          }),
          makeReservation({
            id: 'later',
            court: { ...makeReservation().court, name: 'Later' },
          }),
        ]),
      ),
    )

    renderHome()

    expect(
      within(
        await within(section()).findByRole('article', { name: /Playing now/ }),
      ).getByText('In progress'),
    ).toBeInTheDocument()
    expect(within(card(/Up next/)).getByText('Starts in 25 min')).toBeInTheDocument()
    expect(
      within(card(/Later/)).queryByText(/In progress|Starts in/),
    ).not.toBeInTheDocument()
  })

  it('hides bookings that have already ended', async () => {
    mockFetch(() =>
      jsonResponse(
        makeReservationPage([
          makeReservation({
            id: 'over',
            court: { ...makeReservation().court, name: 'Finished' },
            start: '2030-01-08T10:00:00-03:00',
            end: '2030-01-08T11:00:00-03:00',
          }),
          makeReservation({ id: 'next' }),
        ]),
      ),
    )

    renderHome()

    await within(section()).findByRole('article', { name: /Court 1 - Guga/ })
    expect(cards()).toHaveLength(1)
    expect(within(section()).getByLabelText('1 upcoming reservation')).toBeInTheDocument()
  })

  it('notes when times are in another timezone', async () => {
    mockFetch(() =>
      jsonResponse(
        makeReservationPage([
          makeReservation({
            court: {
              id: 'campo-1',
              name: 'Campo 1',
              club: {
                id: 'lisboa',
                name: 'Lisboa Tennis Club',
                timezone: 'Europe/Lisbon',
              },
            },
            start: '2030-01-09T08:00:00+00:00',
            end: '2030-01-09T09:00:00+00:00',
          }),
        ]),
      ),
    )

    renderHome()

    const booking = await within(section()).findByRole('article', {
      name: 'Campo 1 Tomorrow 08:00–09:00 60 min',
    })
    expect(within(booking).getByText(/Slots in Lisbon time/)).toBeInTheDocument()
  })

  it('invites the user to book when there is nothing upcoming', async () => {
    const user = userEvent.setup()
    mockFetch(() => jsonResponse(makeReservationPage([])))

    renderHome()

    expect(
      await within(section()).findByRole('heading', { name: 'No upcoming reservations' }),
    ).toBeInTheDocument()
    expect(
      within(section()).queryByRole('button', { name: 'Book another court' }),
    ).not.toBeInTheDocument()

    await user.click(within(section()).getByRole('button', { name: 'Find a court' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/courts')
  })

  it('links to the booking history', async () => {
    const user = userEvent.setup()
    mockFetch(() => jsonResponse(makeReservationPage([])))

    renderHome()
    await user.click(
      await within(section()).findByRole('button', { name: 'Booking history' }),
    )

    expect(screen.getByTestId('location')).toHaveTextContent('/bookings')
  })

  it('links to booking another court', async () => {
    const user = userEvent.setup()
    mockFetch(() => jsonResponse(makeReservationPage([makeReservation()])))

    renderHome()
    await user.click(
      await within(section()).findByRole('button', { name: 'Book another court' }),
    )

    expect(screen.getByTestId('location')).toHaveTextContent('/courts')
  })

  describe('long lists', () => {
    it('shows the next 5, then more on request', async () => {
      const user = userEvent.setup()
      mockFetch(() => jsonResponse(makeReservationPage(series(8))))

      renderHome()

      await waitFor(() => expect(cards()).toHaveLength(5))
      expect(
        within(section()).getByText('Showing 5 of 8 reservations'),
      ).toBeInTheDocument()
      expect(cards()[0]).toHaveAccessibleName(/^Court 1 /)

      await user.click(within(section()).getByRole('button', { name: 'Show 3 more' }))

      expect(cards()).toHaveLength(8)
      expect(within(section()).queryByText(/Showing/)).not.toBeInTheDocument()
    })

    it('loads the next page once the loaded ones are all shown', async () => {
      const user = userEvent.setup()
      const fetchMock = mockFetch((url) =>
        url.searchParams.get('page') === '2'
          ? jsonResponse(makeReservationPage(series(2, 25), { count: 27, page: 2 }))
          : jsonResponse(makeReservationPage(series(25), { count: 27, hasNext: true })),
      )

      renderHome()
      await waitFor(() => expect(cards()).toHaveLength(5))

      await user.click(within(section()).getByRole('button', { name: 'Show 10 more' }))
      await user.click(within(section()).getByRole('button', { name: 'Show 10 more' }))
      expect(cards()).toHaveLength(25)
      expect(requestedUrls(fetchMock)).toHaveLength(1)

      await user.click(within(section()).getByRole('button', { name: 'Show 2 more' }))

      await waitFor(() => expect(cards()).toHaveLength(27))
      expect(requestedUrls(fetchMock).at(-1)).toBe(
        '/api/v1/reservations/?state=upcoming%2Cpending_payment&ordering=start&page=2',
      )
    })

    it('keeps what it has when the next page fails, and can retry', async () => {
      const user = userEvent.setup()
      let failPageTwo = true
      mockFetch((url) => {
        if (url.searchParams.get('page') === '2') {
          return failPageTwo
            ? new Response('', { status: 503 })
            : jsonResponse(makeReservationPage(series(1, 25), { count: 26, page: 2 }))
        }
        return jsonResponse(makeReservationPage(series(25), { count: 26, hasNext: true }))
      })

      renderHome()
      await waitFor(() => expect(cards()).toHaveLength(5))
      for (const step of ['Show 10 more', 'Show 10 more', 'Show 1 more']) {
        await user.click(within(section()).getByRole('button', { name: step }))
      }

      expect(await within(section()).findByRole('alert')).toHaveTextContent(
        "CourtControl couldn't load more reservations right now (503).",
      )
      expect(cards()).toHaveLength(25)

      failPageTwo = false
      await user.click(within(section()).getByRole('button', { name: 'Show 1 more' }))

      await waitFor(() => expect(cards()).toHaveLength(26))
      expect(within(section()).queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('errors', () => {
    it('explains a failure and recovers on retry', async () => {
      const user = userEvent.setup()
      let fail = true
      mockFetch(() =>
        fail
          ? new Response('', { status: 500 })
          : jsonResponse(makeReservationPage([makeReservation()])),
      )

      renderHome()

      expect(await within(section()).findByRole('alert')).toHaveTextContent(
        "CourtControl couldn't load your reservations right now (500). Try again in a moment.",
      )

      fail = false
      await user.click(within(section()).getByRole('button', { name: 'Try again' }))

      expect(await within(section()).findByRole('article')).toBeInTheDocument()
    })

    it('explains when the API cannot be reached', async () => {
      mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))

      renderHome()

      expect(await within(section()).findByRole('alert')).toHaveTextContent(
        /can't reach courtcontrol/i,
      )
    })

    it('re-checks the session on a 403', async () => {
      mockFetch(() =>
        jsonResponse({ detail: 'Authentication credentials were not provided.' }, 403),
      )

      const { auth } = renderHome()

      expect(await within(section()).findByRole('alert')).toHaveTextContent(
        'Your session has expired. Sign in again to see your reservations.',
      )
      await waitFor(() => expect(auth.refresh).toHaveBeenCalled())
    })
  })
})
