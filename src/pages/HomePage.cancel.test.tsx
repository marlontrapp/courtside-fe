import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { COURTS_QUERY_KEY } from '@/api/courts'
import { RESERVATION_HISTORY_QUERY_KEY, type Reservation } from '@/api/reservations'
import { HomePage } from '@/pages/HomePage'
import { makeReservation, makeReservationPage } from '@/test/factories'
import { jsonResponse, mockFetch } from '@/test/fetch'
import { freezeDate, renderWithProviders } from '@/test/render'

const CANCEL_GUGA = 'Cancel booking: Court 1 - Guga, Tomorrow 18:00–19:00'

type Cancel = (id: string, body: { reason: string }) => Response | Promise<Response>

/** Fake CourtControl: the upcoming list comes from `api.list`, cancellations go to `api.cancel`. */
type Api = { list: Reservation[]; cancel: Cancel }

function mockApi(initial: Partial<Api> = {}) {
  const api: Api = {
    list: initial.list ?? [
      makeReservation({
        id: 'guga',
        guests: ['ana@example.com', 'bruno@example.com'],
        cancellation_deadline: '2030-01-08T18:00:00-03:00',
      }),
    ],
    cancel:
      initial.cancel ??
      ((id: string, body: { reason: string }) => {
        const reservation = api.list.find((item) => item.id === id)!
        api.list = api.list.filter((item) => item.id !== id)
        return jsonResponse({
          ...reservation,
          status: 'CANCELLED',
          state: 'cancelled',
          can_cancel: false,
          notes: body.reason,
        })
      }),
  }
  const fetchMock = mockFetch(async (url, init) => {
    const match = /^\/api\/v1\/reservations\/([^/]+)\/cancel\/$/.exec(url.pathname)
    if (match && init?.method === 'POST') {
      return api.cancel(decodeURIComponent(match[1]), JSON.parse(String(init.body)))
    }
    return jsonResponse(makeReservationPage(api.list))
  })
  const cancelCalls = () =>
    fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([input, init]) => ({
        url: String(input),
        body: JSON.parse(String(init!.body)),
      }))
  const listCalls = () =>
    fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'GET').length
  return { api, cancelCalls, listCalls }
}

const section = () => screen.getByRole('region', { name: 'Upcoming reservations' })

async function openConfirm(user: ReturnType<typeof userEvent.setup>, name = CANCEL_GUGA) {
  await user.click(await within(section()).findByRole('button', { name }))
  return screen.getByRole('dialog', { name: 'Cancel booking?' })
}

describe('Cancelling a booking', () => {
  beforeEach(() => {
    freezeDate('2030-01-08T12:00:00-03:00')
    document.cookie = 'csrftoken=test-csrf-token'
  })

  it('greys the button out and says why when CourtControl does not allow it', async () => {
    const user = userEvent.setup()
    const { cancelCalls } = mockApi({
      list: [
        makeReservation({ id: 'mine' }),
        makeReservation({
          id: 'guest',
          court: { ...makeReservation().court, name: 'Guest court' },
          role: 'guest',
          primary_player: 'carla@example.com',
          can_cancel: false,
        }),
        makeReservation({
          id: 'late',
          court: { ...makeReservation().court, name: 'Late court' },
          // Deadline = start − the club's 24 h window.
          start: '2030-01-09T09:00:00-03:00',
          end: '2030-01-09T10:00:00-03:00',
          cancellation_deadline: '2030-01-08T09:00:00-03:00',
          can_cancel: false,
        }),
      ],
    })

    renderWithProviders(<HomePage />)

    const allowed = await within(section()).findByRole('button', { name: CANCEL_GUGA })
    expect(allowed).toBeEnabled()
    expect(allowed).toHaveAttribute('aria-haspopup', 'dialog')
    expect(allowed).not.toHaveAccessibleDescription()

    const late = within(section()).getByRole('button', {
      name: /Cancel booking: Late court/,
    })
    expect(late).toBeDisabled()
    expect(late).toHaveAccessibleDescription(
      "The club doesn't permit cancellations within 24 hours of the start of the booking.",
    )
    expect(
      within(section()).getByText(
        "The club doesn't permit cancellations within 24 hours of the start of the booking.",
      ),
    ).toBeVisible()
    const lateCard = within(section()).getByRole('article', { name: /Late court/ })
    expect(within(lateCard).getByText('Not available')).toBeInTheDocument()

    const guest = within(section()).getByRole('button', {
      name: /Cancel booking: Guest court/,
    })
    expect(guest).toBeDisabled()
    expect(guest).toHaveAccessibleDescription(
      "Guests can't cancel a booking. Ask the booking owner to cancel it.",
    )

    // The confusing "cancellation window" wording is gone.
    expect(within(section()).queryByText(/cancellation window/i)).not.toBeInTheDocument()
    await user.click(late)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cancelCalls()).toHaveLength(0)
  })

  it('asks for confirmation first, starting on the safe choice', async () => {
    const user = userEvent.setup()
    const { cancelCalls } = mockApi()
    renderWithProviders(<HomePage />)

    const dialog = await openConfirm(user)

    expect(dialog).toHaveClass('h-dvh') // full screen on phones
    expect(within(dialog).getByText('Court 1 - Guga')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Tomorrow, 18:00–19:00 · Singles'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('The court is released for other players right away.'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        '2 guests will be notified: ana@example.com, bruno@example.com.',
      ),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Free cancellation until today, 18:00.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Keep booking' })).toHaveFocus()
    expect(cancelCalls()).toHaveLength(0)
  })

  it.each([
    [
      'Keep booking',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Keep booking' })),
    ],
    [
      'Escape',
      async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}'),
    ],
  ])('keeps the booking with %s', async (_how, dismiss) => {
    const user = userEvent.setup()
    const { cancelCalls } = mockApi()
    renderWithProviders(<HomePage />)
    await openConfirm(user)

    await dismiss(user)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cancelCalls()).toHaveLength(0)
    expect(within(section()).getByRole('button', { name: CANCEL_GUGA })).toHaveFocus()
  })

  it('cancels on confirmation, then removes the booking and confirms', async () => {
    const user = userEvent.setup()
    const { cancelCalls, listCalls } = mockApi()
    const { queryClient } = renderWithProviders(<HomePage />)
    queryClient.setQueryData([...COURTS_QUERY_KEY, {}], { pages: [], pageParams: [] })
    queryClient.setQueryData([...RESERVATION_HISTORY_QUERY_KEY, {}], {
      pages: [],
      pageParams: [],
    })
    const dialog = await openConfirm(user)

    await user.type(
      within(dialog).getByLabelText('Reason (optional)'),
      '  Rain forecast ',
    )
    expect(within(dialog).getByText('Saved with the booking. 16/500')).toBeInTheDocument()
    const listsBefore = listCalls()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(cancelCalls()).toEqual([
      { url: '/api/v1/reservations/guga/cancel/', body: { reason: 'Rain forecast' } },
    ])
    const notice = within(section()).getByText(
      'Booking cancelled: Court 1 - Guga, tomorrow 18:00–19:00.',
    )
    expect(notice).toHaveFocus()
    expect(within(section()).queryByRole('article')).not.toBeInTheDocument()
    // Reservations refetch; court availability (the freed slot) is stale.
    await waitFor(() => expect(listCalls()).toBeGreaterThan(listsBefore))
    expect(queryClient.getQueryState([...COURTS_QUERY_KEY, {}])?.isInvalidated).toBe(true)
    // …and the history now has a cancelled booking.
    expect(
      queryClient.getQueryState([...RESERVATION_HISTORY_QUERY_KEY, {}])?.isInvalidated,
    ).toBe(true)
    expect(
      await within(section()).findByRole('heading', { name: 'No upcoming reservations' }),
    ).toBeInTheDocument()
  })

  it('hides the card at once, before the list refetch lands', async () => {
    const user = userEvent.setup()
    const { api } = mockApi({
      list: [
        makeReservation({ id: 'guga' }),
        makeReservation({
          id: 'other',
          court: { ...makeReservation().court, name: 'Other court' },
          can_cancel: false,
        }),
      ],
    })
    renderWithProviders(<HomePage />)
    const dialog = await openConfirm(user)
    // The server keeps listing it (e.g. a slow replica): the UI must not.
    api.cancel = () =>
      jsonResponse({
        ...api.list[0],
        status: 'CANCELLED',
        state: 'cancelled',
        can_cancel: false,
      })

    await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))

    await within(section()).findByText(/Booking cancelled/)
    expect(within(section()).getAllByRole('article')).toHaveLength(1)
    expect(within(section()).getByRole('article')).toHaveAccessibleName(/Other court/)
  })

  it('cannot be dismissed while the cancellation is in flight', async () => {
    const user = userEvent.setup()
    let release: (response: Response) => void = () => {}
    const { api } = mockApi()
    renderWithProviders(<HomePage />)
    const dialog = await openConfirm(user)
    const original = api.list[0]
    api.cancel = () => new Promise<Response>((resolve) => (release = resolve))

    await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))

    expect(within(dialog).getByRole('button', { name: 'Cancelling…' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Keep booking' })).toBeDisabled()
    expect(within(dialog).getByLabelText('Reason (optional)')).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Cancel booking?' })).toBeInTheDocument()

    release(jsonResponse({ ...original, status: 'CANCELLED', state: 'cancelled' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  describe('when CourtControl refuses', () => {
    it('explains a passed deadline (409), blocks retrying, and refreshes the list', async () => {
      const user = userEvent.setup()
      const detail =
        'The cancellation deadline has passed: Ibirapuera Tennis Center allows cancelling up to 24 hours before the start (deadline was 2030-01-08 18:00).'
      const { api, listCalls } = mockApi({
        cancel: () => {
          api.list = [{ ...api.list[0], can_cancel: false }]
          return jsonResponse({ detail }, 409)
        },
      })
      renderWithProviders(<HomePage />)
      const dialog = await openConfirm(user)
      const listsBefore = listCalls()

      await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(detail)
      expect(
        within(dialog).getByRole('button', { name: 'Cancel booking' }),
      ).toBeDisabled()
      await waitFor(() => expect(listCalls()).toBeGreaterThan(listsBefore))

      await user.click(within(dialog).getByRole('button', { name: 'Keep booking' }))
      // The refreshed list greys the button out and says why.
      await waitFor(() =>
        expect(
          within(section()).getByRole('button', { name: CANCEL_GUGA }),
        ).toBeDisabled(),
      )
      expect(
        within(section()).getByRole('button', { name: CANCEL_GUGA }),
      ).toHaveAccessibleDescription(
        "The club doesn't permit cancellations within 24 hours of the start of the booking.",
      )
      expect(within(section()).getByRole('article')).toBeInTheDocument()
    })

    it.each([
      [
        'a booking that no longer exists (404)',
        () => jsonResponse({ detail: 'Not found.' }, 404),
        'This booking no longer exists — it may already have been removed.',
        true,
      ],
      [
        'a guest trying to cancel (403)',
        () =>
          jsonResponse(
            { detail: 'Only the player who made the booking can cancel it.' },
            403,
          ),
        'Only the player who made the booking can cancel it.',
        true,
      ],
      [
        'a server error',
        () => new Response('', { status: 500 }),
        "CourtControl couldn't cancel the booking right now (500). Try again in a moment.",
        false,
      ],
      [
        'a network failure',
        () => Promise.reject(new TypeError('Failed to fetch')),
        "Can't reach CourtControl. Check your connection and try again.",
        false,
      ],
    ])('explains %s', async (_case, cancel, message, final) => {
      const user = userEvent.setup()
      mockApi({ cancel })
      renderWithProviders(<HomePage />)
      const dialog = await openConfirm(user)

      await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
      const confirm = within(dialog).getByRole('button', { name: 'Cancel booking' })
      if (final) expect(confirm).toBeDisabled()
      else expect(confirm).toBeEnabled()
    })

    it('lets the user retry after a failure (cancelling is idempotent)', async () => {
      const user = userEvent.setup()
      const { api, cancelCalls } = mockApi()
      const succeed = api.cancel
      let attempts = 0
      api.cancel = (id, body) =>
        ++attempts === 1 ? new Response('', { status: 503 }) : succeed(id, body)
      renderWithProviders(<HomePage />)
      const dialog = await openConfirm(user)

      await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))
      await within(dialog).findByRole('alert')
      await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))

      expect(await within(section()).findByText(/Booking cancelled/)).toBeInTheDocument()
      expect(cancelCalls()).toHaveLength(2)
    })

    it('shows reason errors on the field', async () => {
      const user = userEvent.setup()
      mockApi({
        cancel: () =>
          jsonResponse(
            { reason: ['Ensure this field has no more than 500 characters.'] },
            400,
          ),
      })
      renderWithProviders(<HomePage />)
      const dialog = await openConfirm(user)

      await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))

      expect(
        await within(dialog).findByText(
          'Ensure this field has no more than 500 characters.',
        ),
      ).toBeInTheDocument()
      expect(within(dialog).getByLabelText('Reason (optional)')).toHaveAttribute(
        'aria-invalid',
        'true',
      )
    })

    it('re-checks the session when signed out', async () => {
      const user = userEvent.setup()
      mockApi({
        cancel: () =>
          jsonResponse({ detail: 'Authentication credentials were not provided.' }, 403),
      })
      const { auth } = renderWithProviders(<HomePage />)
      const dialog = await openConfirm(user)

      await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Your session has expired. Sign in again to cancel.',
      )
      expect(auth.refresh).toHaveBeenCalled()
    })
  })

  it('limits the reason to what CourtControl accepts', async () => {
    const user = userEvent.setup()
    mockApi()
    renderWithProviders(<HomePage />)
    const dialog = await openConfirm(user)

    expect(within(dialog).getByLabelText('Reason (optional)')).toHaveAttribute(
      'maxlength',
      '500',
    )
  })

  it('mentions unpaid holds', async () => {
    const user = userEvent.setup()
    mockApi({
      list: [
        makeReservation({
          id: 'hold',
          state: 'pending_payment',
          status: 'PENDING_PAYMENT',
        }),
      ],
    })
    renderWithProviders(<HomePage />)

    const dialog = await openConfirm(user)

    expect(
      within(dialog).getByText("This hold hasn't been paid yet."),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Can be cancelled until it starts.'),
    ).toBeInTheDocument()
  })
})
