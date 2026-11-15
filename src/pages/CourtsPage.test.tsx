import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { CourtsPage } from '@/pages/CourtsPage'
import { makeClub, makeCourt, makePage } from '@/test/factories'
import { jsonResponse, mockFetch, requestedUrls } from '@/test/fetch'
import { freezeDate, renderWithProviders } from '@/test/render'

const jardins = makeClub({
  id: 'club-jardins',
  name: 'Jardins Country Club',
  access_type: 'MEMBERS_ONLY',
})
const lisboa = makeClub({
  id: 'club-lisboa',
  name: 'Lisboa Tennis Club',
  timezone: 'Europe/Lisbon',
})

function renderPage() {
  return renderWithProviders(<CourtsPage />, { route: '/courts' })
}

/** Card for a court, located by its heading. */
function courtCard(name: string) {
  return screen.getByRole('article', { name })
}

/** Fetch handler that replies with the given responses in order, repeating the last. */
function sequence(...responses: Array<() => Response | Promise<Response>>) {
  let call = 0
  return () => responses[Math.min(call++, responses.length - 1)]()
}

describe('CourtsPage', () => {
  // Fixture slots are on 2030-01-08 (club-local), so that's "today".
  beforeEach(() => freezeDate())

  it('shows a loading state while courts are fetched', async () => {
    mockFetch(() => new Promise<Response>(() => {}))

    renderPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Find a court' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading courts…')
  })

  it('lists courts grouped by club with their details', async () => {
    mockFetch(() =>
      jsonResponse(
        makePage([
          makeCourt({ name: 'Court 1 - Guga' }),
          makeCourt({
            name: 'Court 3 - Indoor',
            surface_type: 'HARD',
            is_indoor: true,
            hourly_rate: '150.00',
            lighting_fee: '0.00',
          }),
          makeCourt({ name: 'Grass Court', surface_type: 'GRASS', club: jardins }),
        ]),
      ),
    )

    renderPage()

    const ibirapuera = await screen.findByRole('region', {
      name: 'Ibirapuera Tennis Center',
    })
    expect(within(ibirapuera).getByText('Open club')).toBeInTheDocument()
    expect(within(ibirapuera).getAllByRole('article')).toHaveLength(2)

    const members = screen.getByRole('region', { name: 'Jardins Country Club' })
    expect(within(members).getByText('Members only')).toBeInTheDocument()
    expect(within(members).getAllByRole('article')).toHaveLength(1)

    const guga = courtCard('Court 1 - Guga')
    expect(within(guga).getByText('Clay · Outdoor · Lighting')).toBeInTheDocument()
    expect(within(guga).getByText('120.00 / hour · +30.00 lighting')).toBeInTheDocument()
    expect(within(guga).getByText('2 slots')).toBeInTheDocument()
    const slots = within(guga).getByRole('list', {
      name: 'Open slots for Court 1 - Guga today',
    })
    // Each free slot is a button that starts a booking.
    expect(
      within(slots)
        .getAllByRole('button')
        .map((slot) => slot.getAttribute('aria-label')),
    ).toEqual([
      'Book Court 1 - Guga today, 17:00–18:00',
      'Book Court 1 - Guga today, 18:00–19:00',
    ])
    expect(within(slots).getAllByRole('button')[0]).toHaveTextContent('17:0060 min')

    const indoor = courtCard('Court 3 - Indoor')
    expect(within(indoor).getByText('Hard · Indoor · Lighting')).toBeInTheDocument()
    expect(within(indoor).getByText('150.00 / hour')).toBeInTheDocument()

    expect(screen.getByText('3 courts across 2 clubs')).toBeInTheDocument()
  })

  it('tells the user when a court has no slots left today', async () => {
    mockFetch(() =>
      jsonResponse(
        makePage([
          makeCourt({
            name: 'Court 4 - Day Court',
            available_slots: [],
            hourly_rate: '0.00',
          }),
        ]),
      ),
    )

    renderPage()

    const card = await screen.findByRole('article', { name: 'Court 4 - Day Court' })
    expect(within(card).getByText('No slots')).toBeInTheDocument()
    expect(within(card).getByText('No open slots left today.')).toBeInTheDocument()
    expect(
      within(card).queryByRole('list', { name: /open slots/i }),
    ).not.toBeInTheDocument()
    // No rate set → no price line (the API sends no currency either).
    expect(within(card).queryByText(/\/ hour/)).not.toBeInTheDocument()
  })

  it('shows schedule notices without announcing them as alerts', async () => {
    mockFetch(() =>
      jsonResponse(
        makePage([
          makeCourt({
            name: 'Court 2 - Maria Esther',
            notices: [
              {
                date: '2030-01-08',
                type: 'TOURNAMENT',
                notes: 'Junior club championship until 14:00',
              },
            ],
          }),
        ]),
      ),
    )

    renderPage()

    const card = await screen.findByRole('article', { name: 'Court 2 - Maria Esther' })
    const notice = within(card).getByRole('note')
    expect(notice).toHaveTextContent(
      'Today · Tournament · Junior club championship until 14:00',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('flags clubs whose slot times are in another timezone', async () => {
    mockFetch(() =>
      jsonResponse(
        makePage([
          makeCourt({ name: 'Court 1 - Guga' }),
          makeCourt({
            name: 'Campo 1',
            club: lisboa,
            available_slots: [
              { start: '2030-01-08T20:00:00+00:00', end: '2030-01-08T21:00:00+00:00' },
            ],
          }),
        ]),
      ),
    )

    renderPage()

    const lisbonSection = await screen.findByRole('region', {
      name: 'Lisboa Tennis Club',
    })
    expect(within(lisbonSection).getByText('Slots in Lisbon time')).toBeInTheDocument()
    expect(
      within(lisbonSection).getByRole('button', {
        name: 'Book Campo 1 today, 20:00–21:00',
      }),
    ).toBeInTheDocument()
    const localSection = screen.getByRole('region', { name: 'Ibirapuera Tennis Center' })
    expect(within(localSection).queryByText(/Slots in/)).not.toBeInTheDocument()
  })

  it('shows an empty state when no courts are bookable', async () => {
    mockFetch(() => jsonResponse(makePage([])))

    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'No courts to book' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/members-only clubs where your membership is active/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  describe('errors', () => {
    it('shows a server error and recovers on retry', async () => {
      const user = userEvent.setup()
      mockFetch(
        sequence(
          () => new Response('Internal Server Error', { status: 500 }),
          () => jsonResponse(makePage([makeCourt({ name: 'Court 1 - Guga' })])),
        ),
      )

      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "CourtControl couldn't load courts right now (500). Try again in a moment.",
      )
      expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Try again' }))

      expect(
        await screen.findByRole('article', { name: 'Court 1 - Guga' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('explains when the API cannot be reached', async () => {
      mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))

      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /can't reach courtcontrol/i,
      )
      expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    })

    it('explains an unexpected response (API proxy pointing at another app)', async () => {
      mockFetch(() => new Response('<!doctype html>', { status: 200 }))

      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /unexpected courts response/i,
      )
    })

    it('re-checks the session when the API says the user is signed out', async () => {
      mockFetch(() =>
        jsonResponse({ detail: 'Authentication credentials were not provided.' }, 403),
      )

      const { auth } = renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent(/session has expired/i)
      await waitFor(() => expect(auth.refresh).toHaveBeenCalledTimes(1))
    })
  })

  describe('pagination', () => {
    it('loads more courts page by page', async () => {
      const user = userEvent.setup()
      const fetchMock = mockFetch((url) =>
        url.searchParams.get('page') === '2'
          ? jsonResponse(
              makePage([makeCourt({ name: 'Court B', club: jardins })], {
                count: 3,
                page: 2,
              }),
            )
          : jsonResponse(
              makePage(
                [
                  makeCourt({ name: 'Court 1 - Guga' }),
                  makeCourt({ name: 'Court A', club: jardins }),
                ],
                {
                  count: 3,
                  hasNext: true,
                },
              ),
            ),
      )

      renderPage()

      expect(await screen.findByText('Showing 2 of 3 courts')).toBeInTheDocument()
      expect(screen.queryByRole('article', { name: 'Court B' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Load more courts' }))

      expect(await screen.findByRole('article', { name: 'Court B' })).toBeInTheDocument()
      // Courts of a club split across pages stay in one section.
      const members = screen.getByRole('region', { name: 'Jardins Country Club' })
      expect(within(members).getAllByRole('article')).toHaveLength(2)
      expect(screen.getByText('3 courts across 2 clubs')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Load more courts' }),
      ).not.toBeInTheDocument()
      // Uses page numbers (DRF's absolute `next` URL would bypass the dev proxy).
      expect(requestedUrls(fetchMock)).toEqual([
        '/api/v1/courts/',
        '/api/v1/courts/?page=2',
      ])
    })

    it('does not repeat a court that shifts onto the next page', async () => {
      const user = userEvent.setup()
      const shifted = makeCourt({ name: 'Court 2' })
      mockFetch((url) =>
        url.searchParams.get('page') === '2'
          ? jsonResponse(
              makePage([shifted, makeCourt({ name: 'Court 3' })], { count: 3, page: 2 }),
            )
          : jsonResponse(
              makePage([makeCourt({ name: 'Court 1' }), shifted], {
                count: 3,
                hasNext: true,
              }),
            ),
      )

      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Load more courts' }))

      expect(await screen.findByRole('article', { name: 'Court 3' })).toBeInTheDocument()
      expect(screen.getAllByRole('article', { name: 'Court 2' })).toHaveLength(1)
    })

    it('keeps loaded courts when loading more fails, and can retry', async () => {
      const user = userEvent.setup()
      let pageTwoCalls = 0
      mockFetch((url) => {
        if (url.searchParams.get('page') === '2') {
          pageTwoCalls += 1
          return pageTwoCalls === 1
            ? new Response('Bad Gateway', { status: 502 })
            : jsonResponse(
                makePage([makeCourt({ name: 'Court B' })], { count: 2, page: 2 }),
              )
        }
        return jsonResponse(
          makePage([makeCourt({ name: 'Court A' })], { count: 2, hasNext: true }),
        )
      })

      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Load more courts' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/\(502\)/)
      expect(courtCard('Court A')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Try loading more again' }))

      expect(await screen.findByRole('article', { name: 'Court B' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('refresh', () => {
    it('reloads the list', async () => {
      const user = userEvent.setup()
      mockFetch(
        sequence(
          () => jsonResponse(makePage([makeCourt({ name: 'Court 1 - Guga' })])),
          () =>
            jsonResponse(
              makePage([makeCourt({ name: 'Court 1 - Guga', available_slots: [] })]),
            ),
        ),
      )

      renderPage()
      expect(await screen.findByText('2 slots')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Refresh' }))

      expect(await screen.findByText('No open slots left today.')).toBeInTheDocument()
    })

    it('keeps the last list visible when a refresh fails', async () => {
      const user = userEvent.setup()
      mockFetch(
        sequence(
          () => jsonResponse(makePage([makeCourt({ name: 'Court 1 - Guga' })])),
          () => Promise.reject(new TypeError('Failed to fetch')),
        ),
      )

      renderPage()
      await screen.findByRole('article', { name: 'Court 1 - Guga' })

      await user.click(screen.getByRole('button', { name: 'Refresh' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /can't reach courtcontrol.*showing the last loaded list/i,
      )
      expect(courtCard('Court 1 - Guga')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
    })
  })
})
