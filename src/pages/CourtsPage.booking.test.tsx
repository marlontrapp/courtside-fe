import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Court } from '@/api/courts'
import {
  UPCOMING_RESERVATIONS_QUERY_KEY,
  type Reservation,
  type ReservationRequest,
} from '@/api/reservations'
import { CourtsPage } from '@/pages/CourtsPage'
import { makeCourt, makePage, makePlayer, makeReservation } from '@/test/factories'
import { jsonResponse, mockFetch } from '@/test/fetch'
import { freezeDate, renderWithProviders } from '@/test/render'

const at = (time: string, day = '2030-01-08') => `${day}T${time}:00-03:00`
const slot = (start: string, end: string, day?: string) => ({
  start: at(start, day),
  end: at(end, day),
})

function guga(overrides: Partial<Court> = {}): Court {
  return makeCourt({
    id: 'court-guga',
    name: 'Court 1 - Guga',
    available_slots: [
      slot('17:00', '18:00'),
      slot('18:00', '19:00'),
      slot('20:00', '21:00'),
    ],
    ...overrides,
  })
}

function reservationFor(request: ReservationRequest, court: Court): Reservation {
  return makeReservation({
    id: 'reservation-1',
    court: {
      id: court.id,
      name: court.name,
      club: { id: court.club.id, name: court.club.name, timezone: court.club.timezone },
    },
    start: at(request.start_time, request.date),
    end: at(request.end_time, request.date),
    booking_type: request.booking_type,
    includes_lighting: request.includes_lighting,
    guests: request.guests.map((email, index) => {
      const local = email.split('@')[0] || `guest${index + 1}`
      return makePlayer({
        id: `guest-${index + 1}`,
        first_name: local.charAt(0).toUpperCase() + local.slice(1),
        last_name: '',
      })
    }),
    notes: request.notes,
    // Consistent with can_cancel: still ahead of the frozen now (2030-01-08 12:00).
    cancellation_deadline: at('15:00', request.date),
  })
}

type Api = {
  courts: Court[]
  book: (request: ReservationRequest) => Response | Promise<Response>
}

/** Fake CourtControl: GET courts from `api.courts`, POST reservations via `api.book`. */
function mockApi(initial: Partial<Api> = {}) {
  const api: Api = {
    courts: [guga()],
    book: (request) => jsonResponse(reservationFor(request, api.courts[0]), 201),
    ...initial,
  }
  const fetchMock = mockFetch(async (url, init) => {
    if (url.pathname === '/api/v1/reservations/' && init?.method === 'POST') {
      return api.book(JSON.parse(String(init.body)) as ReservationRequest)
    }
    return jsonResponse(makePage(api.courts))
  })
  const bookings = () =>
    fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([, init]) => ({
        body: JSON.parse(String(init!.body)) as ReservationRequest,
        headers: new Headers(init!.headers),
      }))
  const courtListCalls = () =>
    fetchMock.mock.calls.filter(([input]) => String(input).startsWith('/api/v1/courts/'))
      .length
  return { api, fetchMock, bookings, courtListCalls }
}

function renderPage() {
  return renderWithProviders(<CourtsPage />, { route: '/courts' })
}

type User = ReturnType<typeof userEvent.setup>

async function openSlot(user: User, name = 'Book Court 1 - Guga today, 17:00–18:00') {
  await user.click(await screen.findByRole('button', { name }))
  return screen.getByRole('dialog', { name: 'Book Court 1 - Guga' })
}

describe('Booking a court', () => {
  beforeEach(() => {
    freezeDate()
    // Django's CSRF cookie, sent back as X-CSRFToken on the POST.
    document.cookie = 'csrftoken=test-csrf-token'
  })

  it('opens a full-screen-on-mobile dialog for the clicked slot', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()

    const trigger = await screen.findByRole('button', {
      name: 'Book Court 1 - Guga today, 17:00–18:00',
    })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).not.toHaveAttribute('aria-pressed')

    const dialog = await openSlot(user)

    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveClass('h-dvh', 'sm:h-auto')
    expect(within(dialog).getByText('Ibirapuera Tennis Center')).toBeInTheDocument()
    expect(within(dialog).getByText('Today · starts 17:00')).toBeInTheDocument()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('offers consecutive free slots as end times, with a live price estimate', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    const dialog = await openSlot(user)

    const until = within(dialog).getByRole('group', { name: 'Until' })
    // 20:00 isn't offered: 19:00–20:00 is taken.
    expect(
      within(until)
        .getAllByRole('button')
        .map((option) => option.textContent),
    ).toEqual(['Until 18:0060 min', 'Until 19:002 h'])
    expect(within(until).getByRole('button', { name: /Until 18:00/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(dialog).getByText('120.00')).toBeInTheDocument()

    await user.click(within(until).getByRole('button', { name: /Until 19:00/ }))
    expect(within(dialog).getByText('240.00')).toBeInTheDocument()

    await user.click(within(dialog).getByLabelText('Include lighting (+30.00 / hour)'))
    expect(within(dialog).getByText('300.00')).toBeInTheDocument()
  })

  it('shows a single slot as a plain time range, and hides lighting on unlit courts', async () => {
    const user = userEvent.setup()
    mockApi({
      courts: [guga({ has_lighting: false, available_slots: [slot('17:00', '18:30')] })],
    })
    renderPage()

    const dialog = await openSlot(user, 'Book Court 1 - Guga today, 17:00–18:30')

    expect(within(dialog).queryByRole('group', { name: 'Until' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('17:00–18:30 · 90 min')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/include lighting/i)).not.toBeInTheDocument()
  })

  it('keeps long days short: later end times are one click away', async () => {
    const user = userEvent.setup()
    const hours = Array.from({ length: 10 }, (_, index) => 8 + index)
    const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00`
    mockApi({
      courts: [
        guga({ available_slots: hours.map((hour) => slot(pad(hour), pad(hour + 1))) }),
      ],
    })
    renderPage()

    const dialog = await openSlot(user, 'Book Court 1 - Guga today, 08:00–09:00')
    const until = within(dialog).getByRole('group', { name: 'Until' })
    expect(within(until).getAllByRole('button')).toHaveLength(6)

    await user.click(within(dialog).getByRole('button', { name: 'Later end times (4)' }))

    expect(within(until).getAllByRole('button')).toHaveLength(10)
    expect(within(until).getByRole('button', { name: /Until 18:00/ })).toBeInTheDocument()
  })

  it('books with everything the API needs, then confirms and refreshes the list', async () => {
    const user = userEvent.setup()
    const { api, bookings, courtListCalls } = mockApi()
    renderPage()
    const dialog = await openSlot(user)

    await user.click(
      within(within(dialog).getByRole('group', { name: 'Until' })).getByRole('button', {
        name: /Until 19:00/,
      }),
    )
    await user.click(within(dialog).getByRole('radio', { name: 'Doubles' }))
    await user.click(within(dialog).getByLabelText(/include lighting/i))
    await user.click(within(dialog).getByRole('button', { name: 'Add guest' }))
    await user.type(within(dialog).getByLabelText('Guest 1 email'), 'ana@example.com')
    await user.type(within(dialog).getByLabelText('Notes (optional)'), 'Bring balls')
    expect(within(dialog).getByText('11/500')).toBeInTheDocument()

    const listCallsBefore = courtListCalls()
    // The court is gone from the list once booked.
    api.courts = [guga({ available_slots: [slot('20:00', '21:00')] })]
    await user.click(within(dialog).getByRole('button', { name: 'Book court' }))

    const confirmation = await screen.findByRole('dialog', { name: 'Court booked' })
    expect(bookings()).toHaveLength(1)
    expect(bookings()[0].body).toEqual({
      court: 'court-guga',
      date: '2030-01-08',
      start_time: '17:00',
      end_time: '19:00',
      booking_type: 'DOUBLES',
      includes_lighting: true,
      guests: ['ana@example.com'],
      notes: 'Bring balls',
    })
    expect(bookings()[0].headers.get('X-CSRFToken')).toBe('test-csrf-token')
    expect(bookings()[0].headers.get('Content-Type')).toBe('application/json')

    expect(within(confirmation).getByRole('alert')).toHaveTextContent(
      'Court booked for today at 17:00.',
    )
    expect(within(confirmation).getByText('Today, 17:00–19:00')).toBeInTheDocument()
    expect(within(confirmation).getByText('Doubles')).toBeInTheDocument()
    expect(within(confirmation).getByText('Ana')).toBeInTheDocument()
    expect(within(confirmation).getByText(/free cancellation until/i)).toHaveTextContent(
      'Free cancellation until today, 15:00.',
    )

    // The list refreshes behind the dialog: the booked slots disappear.
    await waitFor(() => expect(courtListCalls()).toBeGreaterThan(listCallsBefore))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Book Court 1 - Guga today, 17:00–18:00' }),
      ).not.toBeInTheDocument(),
    )

    await user.click(within(confirmation).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The clicked slot is gone, so focus lands on the court's card.
    await waitFor(() =>
      expect(screen.getByRole('article', { name: 'Court 1 - Guga' })).toHaveFocus(),
    )
  })

  it("marks the user's reservations (Home) as stale after booking", async () => {
    const user = userEvent.setup()
    mockApi()
    const { queryClient } = renderPage()
    queryClient.setQueryData(UPCOMING_RESERVATIONS_QUERY_KEY, {
      pages: [],
      pageParams: [],
    })

    const dialog = await openSlot(user)
    await user.click(within(dialog).getByRole('button', { name: 'Book court' }))
    await screen.findByRole('dialog', { name: 'Court booked' })

    expect(
      queryClient.getQueryState(UPCOMING_RESERVATIONS_QUERY_KEY)?.isInvalidated,
    ).toBe(true)
  })

  it("explains when the booking can't be cancelled anymore", async () => {
    const user = userEvent.setup()
    const { api } = mockApi()
    api.book = (request) =>
      jsonResponse({ ...reservationFor(request, api.courts[0]), can_cancel: false }, 201)
    renderPage()

    const dialog = await openSlot(user)
    await user.click(within(dialog).getByRole('button', { name: 'Book court' }))

    expect(
      await screen.findByText(/inside the club's cancellation window/i),
    ).toBeInTheDocument()
  })

  it('sends a slot that ends at midnight as 24:00', async () => {
    const user = userEvent.setup()
    const { bookings } = mockApi({
      courts: [
        guga({
          available_slots: [{ start: at('23:00'), end: '2030-01-09T00:00:00-03:00' }],
        }),
      ],
    })
    renderPage()

    const dialog = await openSlot(user, 'Book Court 1 - Guga today, 23:00–00:00')
    expect(within(dialog).getByText('23:00–24:00 · 60 min')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Book court' }))

    await screen.findByRole('dialog', { name: 'Court booked' })
    expect(bookings()[0].body).toMatchObject({ date: '2030-01-08', end_time: '24:00' })
  })

  describe('guests', () => {
    it('validates emails and duplicates before sending, up to 3 guests', async () => {
      const user = userEvent.setup()
      const { bookings } = mockApi()
      renderPage()
      const dialog = await openSlot(user)
      const addGuest = within(dialog).getByRole('button', { name: 'Add guest' })

      await user.click(addGuest)
      await user.type(within(dialog).getByLabelText('Guest 1 email'), 'not-an-email')
      await user.click(addGuest)
      await user.type(within(dialog).getByLabelText('Guest 2 email'), 'ana@example.com')
      await user.click(addGuest)
      await user.type(within(dialog).getByLabelText('Guest 3 email'), 'ANA@example.com')
      expect(addGuest).toBeDisabled()

      await user.click(within(dialog).getByRole('button', { name: 'Book court' }))

      expect(await within(dialog).findByText('Enter a valid email.')).toBeInTheDocument()
      expect(within(dialog).getByText('This guest is already added.')).toBeInTheDocument()
      expect(within(dialog).getByLabelText('Guest 1 email')).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      expect(bookings()).toHaveLength(0)

      await user.click(within(dialog).getByRole('button', { name: 'Remove guest 3' }))
      await user.click(within(dialog).getByRole('button', { name: 'Remove guest 1' }))
      expect(addGuest).toBeEnabled()
      await user.click(within(dialog).getByRole('button', { name: 'Book court' }))

      await screen.findByRole('dialog', { name: 'Court booked' })
      expect(bookings()[0].body.guests).toEqual(['ana@example.com'])
    })

    it('ignores empty guest rows', async () => {
      const user = userEvent.setup()
      const { bookings } = mockApi()
      renderPage()
      const dialog = await openSlot(user)

      await user.click(within(dialog).getByRole('button', { name: 'Add guest' }))
      await user.click(within(dialog).getByRole('button', { name: 'Book court' }))

      await screen.findByRole('dialog', { name: 'Court booked' })
      expect(bookings()[0].body.guests).toEqual([])
    })

    it("shows the API's guest errors under the guests", async () => {
      const user = userEvent.setup()
      mockApi({
        book: () =>
          jsonResponse(
            { guests: ['No registered player with email: nobody@example.com.'] },
            400,
          ),
      })
      renderPage()
      const dialog = await openSlot(user)

      await user.click(within(dialog).getByRole('button', { name: 'Add guest' }))
      await user.type(
        within(dialog).getByLabelText('Guest 1 email'),
        'nobody@example.com',
      )
      await user.click(within(dialog).getByRole('button', { name: 'Book court' }))

      expect(
        await within(dialog).findByText(
          'No registered player with email: nobody@example.com.',
        ),
      ).toBeInTheDocument()
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Book court' })).toBeEnabled()
    })
  })

  describe('failures', () => {
    it('tells the user when the slot was just taken, and refreshes the list', async () => {
      const user = userEvent.setup()
      const { api, courtListCalls } = mockApi({
        book: () =>
          jsonResponse(
            {
              non_field_errors: ['Court already has an overlapping active reservation.'],
            },
            409,
          ),
      })
      renderPage()
      const dialog = await openSlot(user)
      const listCallsBefore = courtListCalls()
      api.courts = [guga({ available_slots: [slot('20:00', '21:00')] })]

      await user.click(within(dialog).getByRole('button', { name: 'Book court' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'That slot was just taken. Pick another time.',
      )
      await waitFor(() => expect(courtListCalls()).toBeGreaterThan(listCallsBefore))
      expect(
        within(dialog).queryByRole('button', { name: 'Book court' }),
      ).not.toBeInTheDocument()

      await user.click(within(dialog).getByRole('button', { name: 'Pick another slot' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() =>
        expect(
          screen.queryByRole('button', {
            name: 'Book Court 1 - Guga today, 17:00–18:00',
          }),
        ).not.toBeInTheDocument(),
      )
      expect(
        screen.getByRole('button', { name: 'Book Court 1 - Guga today, 20:00–21:00' }),
      ).toBeInTheDocument()
    })

    it.each([
      [
        'a booking rule',
        () =>
          jsonResponse(
            {
              non_field_errors: [
                "Booking must end when one of the court's slots ends (that day: 17:00–18:00).",
              ],
            },
            400,
          ),
        "Booking must end when one of the court's slots ends (that day: 17:00–18:00).",
      ],
      [
        'a court the user lost access to',
        () =>
          jsonResponse(
            { court: ['Invalid pk "court-guga" - object does not exist.'] },
            400,
          ),
        'This court is no longer available to you.',
      ],
      [
        'a server error',
        () => new Response('', { status: 500 }),
        "CourtControl couldn't book the court right now (500). Try again in a moment.",
      ],
      [
        'a network failure',
        () => Promise.reject(new TypeError('Failed to fetch')),
        "Can't reach CourtControl. Check your connection and try again.",
      ],
    ])('explains %s and lets the user retry', async (_case, book, message) => {
      const user = userEvent.setup()
      mockApi({ book })
      renderPage()
      const dialog = await openSlot(user)

      await user.click(within(dialog).getByRole('button', { name: 'Book court' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
      expect(within(dialog).getByRole('button', { name: 'Book court' })).toBeEnabled()
    })

    it('re-checks the session on a 403', async () => {
      const user = userEvent.setup()
      mockApi({
        book: () =>
          jsonResponse({ detail: 'Authentication credentials were not provided.' }, 403),
      })
      const { auth } = renderPage()
      const dialog = await openSlot(user)

      await user.click(within(dialog).getByRole('button', { name: 'Book court' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        /session has expired/i,
      )
      expect(auth.refresh).toHaveBeenCalled()
    })
  })

  it('stays open and locked while the booking is in flight', async () => {
    const user = userEvent.setup()
    let release: (response: Response) => void = () => {}
    const { api } = mockApi()
    api.book = () => new Promise<Response>((resolve) => (release = resolve))
    renderPage()
    const dialog = await openSlot(user)

    await user.click(within(dialog).getByRole('button', { name: 'Book court' }))

    const submit = within(dialog).getByRole('button', { name: 'Booking…' })
    expect(submit).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.keyboard('{Escape}')
    await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }))
    expect(
      screen.getByRole('dialog', { name: 'Book Court 1 - Guga' }),
    ).toBeInTheDocument()

    release(
      jsonResponse(
        reservationFor(
          {
            court: 'court-guga',
            date: '2030-01-08',
            start_time: '17:00',
            end_time: '18:00',
            booking_type: 'SINGLES',
            includes_lighting: false,
            guests: [],
            notes: '',
          },
          api.courts[0],
        ),
        201,
      ),
    )
    expect(
      await screen.findByRole('dialog', { name: 'Court booked' }),
    ).toBeInTheDocument()
  })

  it('closes without booking, returning focus to the slot', async () => {
    const user = userEvent.setup()
    const { bookings } = mockApi()
    renderPage()
    const trigger = await screen.findByRole('button', {
      name: 'Book Court 1 - Guga today, 17:00–18:00',
    })

    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(bookings()).toHaveLength(0)
  })

  it('starts a fresh form for each slot', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()

    let dialog = await openSlot(user)
    await user.click(within(dialog).getByRole('radio', { name: 'Lesson' }))
    await user.keyboard('{Escape}')

    dialog = await openSlot(user, 'Book Court 1 - Guga today, 18:00–19:00')
    expect(within(dialog).getByRole('radio', { name: 'Singles' })).toBeChecked()
    expect(within(dialog).getByText('Today · starts 18:00')).toBeInTheDocument()
  })
})
