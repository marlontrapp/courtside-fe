import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Court } from '@/api/courts'
import { CourtsPage } from '@/pages/CourtsPage'
import { IBIRAPUERA, makeClub, makeCourt, makePage } from '@/test/factories'
import { jsonResponse, mockFetch, requestedUrls } from '@/test/fetch'
import { LocationProbe } from '@/test/LocationProbe'
import { currentSearch, freezeDate, renderWithProviders } from '@/test/render'

const JARDINS = makeClub({
  id: '965e8bf3-8829-46f9-8b2d-4ea6cbc76f5b',
  name: 'Jardins Country Club',
  access_type: 'MEMBERS_ONLY',
})

const guga = makeCourt({ name: 'Court 1 - Guga' })
const indoor = makeCourt({
  name: 'Court 3 - Indoor',
  surface_type: 'HARD',
  is_indoor: true,
})
const grass = makeCourt({ name: 'Grass Court', surface_type: 'GRASS', club: JARDINS })
const ALL_COURTS = [guga, indoor, grass]

type Responder = (params: URLSearchParams) => Response | Promise<Response>

/** Fake courts API; by default every request gets the full unfiltered list. */
function mockCourtsApi(respond: Responder = () => jsonResponse(makePage(ALL_COURTS))) {
  return mockFetch((url) => respond(url.searchParams))
}

function renderPage(route = '/courts') {
  return renderWithProviders(
    <>
      <CourtsPage />
      <LocationProbe />
    </>,
    { route },
  )
}

/** Query params of the most recent courts request. */
function lastRequest(fetchMock: ReturnType<typeof mockFetch>): URLSearchParams {
  const url = requestedUrls(fetchMock).at(-1) ?? ''
  return new URLSearchParams(url.split('?')[1] ?? '')
}

type User = ReturnType<typeof userEvent.setup>

/** Pick a day like a user: open the field's calendar, click the day (labelled by ISO date). */
async function pickDate(user: User, field: 'Date' | 'End date', isoDate: string) {
  await user.click(screen.getByRole('button', { name: field }))
  const calendar = screen.getByRole('dialog', { name: field })
  await user.click(within(calendar).getByRole('button', { name: isoDate }))
}

/** Open a date field's calendar and return it. */
async function openCalendar(user: User, field: 'Date' | 'End date') {
  await user.click(screen.getByRole('button', { name: field }))
  return screen.getByRole('dialog', { name: field })
}

const pageSearch = () => currentSearch(screen.getByTestId)
const courtNames = () =>
  screen
    .queryAllByRole('article')
    .map((card) => within(card).getByRole('heading').textContent)

/** Resolve with only the courts matching `predicate`. */
const only = (predicate: (court: Court) => boolean) =>
  jsonResponse(makePage(ALL_COURTS.filter(predicate)))

describe('CourtsPage filters', () => {
  beforeEach(() => freezeDate())

  it('starts unfiltered', async () => {
    const fetchMock = mockCourtsApi()

    renderPage()

    await screen.findByRole('article', { name: 'Court 1 - Guga' })
    const filters = screen.getByRole('region', { name: 'Filters' })
    expect(within(filters).getByRole('checkbox', { name: 'All' })).toBeChecked()
    expect(within(filters).getByRole('radio', { name: 'All' })).toBeChecked()
    expect(within(filters).getByRole('button', { name: 'Clubs' })).toHaveTextContent(
      'All clubs',
    )
    expect(
      within(filters).getByRole('button', { name: 'Earliest start' }),
    ).toHaveTextContent('Any time')
    expect(
      within(filters).queryByRole('button', { name: 'Clear filters' }),
    ).not.toBeInTheDocument()
    expect(requestedUrls(fetchMock)).toEqual(['/api/v1/courts/'])
  })

  it('filters by one or more surfaces', async () => {
    const user = userEvent.setup()
    const fetchMock = mockCourtsApi((params) => {
      const surfaces = params.get('surface_type')?.split(',')
      return surfaces
        ? only((court) => surfaces.includes(court.surface_type))
        : only(() => true)
    })

    renderPage()
    await screen.findByRole('article', { name: 'Grass Court' })

    await user.click(screen.getByRole('checkbox', { name: 'Clay' }))
    await waitFor(() => expect(courtNames()).toEqual(['Court 1 - Guga']))
    expect(lastRequest(fetchMock).get('surface_type')).toBe('CLAY')

    await user.click(screen.getByRole('checkbox', { name: 'Grass' }))
    await waitFor(() => expect(courtNames()).toEqual(['Court 1 - Guga', 'Grass Court']))
    expect(lastRequest(fetchMock).get('surface_type')).toBe('CLAY,GRASS')
    expect(pageSearch().get('surface')).toBe('CLAY,GRASS')
    expect(screen.getByRole('checkbox', { name: 'All' })).not.toBeChecked()

    // "All" clears the surface filter.
    await user.click(screen.getByRole('checkbox', { name: 'All' }))
    await waitFor(() => expect(courtNames()).toHaveLength(3))
    expect(lastRequest(fetchMock).has('surface_type')).toBe(false)
    expect(pageSearch().has('surface')).toBe(false)
  })

  it('filters indoor or outdoor courts', async () => {
    const user = userEvent.setup()
    const fetchMock = mockCourtsApi((params) => {
      const value = params.get('is_indoor')
      return value
        ? only((court) => court.is_indoor === (value === 'true'))
        : only(() => true)
    })

    renderPage()
    await screen.findByRole('article', { name: 'Court 3 - Indoor' })

    await user.click(screen.getByRole('radio', { name: 'Indoor' }))
    await waitFor(() => expect(courtNames()).toEqual(['Court 3 - Indoor']))
    expect(lastRequest(fetchMock).get('is_indoor')).toBe('true')
    expect(pageSearch().get('setting')).toBe('indoor')

    await user.click(screen.getByRole('radio', { name: 'Outdoor' }))
    await waitFor(() => expect(courtNames()).toEqual(['Court 1 - Guga', 'Grass Court']))
    expect(lastRequest(fetchMock).get('is_indoor')).toBe('false')
  })

  describe('clubs', () => {
    it('offers the clubs of the loaded list without another request', async () => {
      const user = userEvent.setup()
      const fetchMock = mockCourtsApi((params) =>
        params.get('club') === JARDINS.id
          ? only((court) => court.club.id === JARDINS.id)
          : only(() => true),
      )

      renderPage()
      await screen.findByRole('article', { name: 'Grass Court' })

      await user.click(screen.getByRole('button', { name: 'Clubs' }))
      const options = within(
        await screen.findByRole('listbox', { name: 'Clubs' }),
      ).getAllByRole('option')
      expect(options.map((option) => option.textContent)).toEqual([
        'Ibirapuera Tennis Center',
        'Jardins Country Club',
      ])
      expect(requestedUrls(fetchMock)).toEqual(['/api/v1/courts/'])

      await user.click(screen.getByRole('option', { name: 'Jardins Country Club' }))
      await user.keyboard('{Escape}')

      await waitFor(() => expect(courtNames()).toEqual(['Grass Court']))
      expect(lastRequest(fetchMock).get('club')).toBe(JARDINS.id)
      expect(pageSearch().get('club')).toBe(JARDINS.id)
      expect(screen.getByRole('button', { name: 'Clubs' })).toHaveTextContent(
        'Jardins Country Club',
      )
    })

    it('loads every bookable club when the list has more pages', async () => {
      const user = userEvent.setup()
      const lisboa = makeClub({ name: 'Lisboa Tennis Club', timezone: 'Europe/Lisbon' })
      const fetchMock = mockCourtsApi((params) =>
        params.get('page') === '2'
          ? jsonResponse(
              makePage([makeCourt({ name: 'Campo 1', club: lisboa })], {
                count: 2,
                page: 2,
              }),
            )
          : jsonResponse(makePage([guga], { count: 2, hasNext: true })),
      )

      renderPage()
      await screen.findByRole('article', { name: 'Court 1 - Guga' })
      await user.click(screen.getByRole('button', { name: 'Clubs' }))

      expect(
        await screen.findByRole('option', { name: 'Lisboa Tennis Club' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: 'Ibirapuera Tennis Center' }),
      ).toBeInTheDocument()
      expect(requestedUrls(fetchMock)).toContain('/api/v1/courts/?page=2')
    })

    it('says so when the club list cannot load, and retries on reopen', async () => {
      const user = userEvent.setup()
      let clubWalkFails = true
      let firstPageCalls = 0
      mockCourtsApi((params) => {
        if (params.get('page') === '2') {
          return jsonResponse(makePage([grass], { count: 2, page: 2 }))
        }
        firstPageCalls += 1
        // The list's own first page loads; the club walk's request for it fails.
        if (firstPageCalls > 1 && clubWalkFails) return new Response('', { status: 500 })
        return jsonResponse(makePage([guga], { count: 2, hasNext: true }))
      })

      renderPage()
      await screen.findByRole('article', { name: 'Court 1 - Guga' })
      await user.click(screen.getByRole('button', { name: 'Clubs' }))

      expect(await screen.findByText(/couldn't load your clubs/i)).toBeInTheDocument()
      expect(courtNames()).toEqual(['Court 1 - Guga'])

      clubWalkFails = false
      await user.keyboard('{Escape}')
      await user.click(screen.getByRole('button', { name: 'Clubs' }))

      expect(
        await screen.findByRole('option', { name: 'Jardins Country Club' }),
      ).toBeInTheDocument()
      expect(screen.queryByText(/couldn't load your clubs/i)).not.toBeInTheDocument()
    })
  })

  describe('dates and times', () => {
    it('searches one day, then a range, grouping slots by day', async () => {
      const fetchMock = mockCourtsApi((params) => {
        if (params.get('date_from')) {
          return jsonResponse(
            makePage([
              makeCourt({
                name: 'Court 1 - Guga',
                available_slots: [
                  {
                    start: '2030-01-09T18:00:00-03:00',
                    end: '2030-01-09T19:00:00-03:00',
                  },
                  {
                    start: '2030-01-10T08:00:00-03:00',
                    end: '2030-01-10T09:00:00-03:00',
                  },
                ],
                notices: [
                  { date: '2030-01-10', type: 'MAINTENANCE', notes: 'Line repainting' },
                ],
              }),
            ]),
          )
        }
        return jsonResponse(makePage(ALL_COURTS))
      })

      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('article', { name: 'Court 1 - Guga' })

      await pickDate(user, 'Date', '2030-01-09')
      await waitFor(() => expect(lastRequest(fetchMock).get('date')).toBe('2030-01-09'))
      expect(screen.getByRole('button', { name: 'Date' })).toHaveTextContent(
        'Wed, Jan 9, 2030',
      )
      expect(pageSearch().get('from')).toBe('2030-01-09')
      expect(
        await screen.findByText('Courts with a free slot on Wed, Jan 9.'),
      ).toBeInTheDocument()

      await pickDate(user, 'End date', '2030-01-10')
      await waitFor(() => {
        const params = lastRequest(fetchMock)
        expect(params.get('date_from')).toBe('2030-01-09')
        expect(params.get('date_to')).toBe('2030-01-10')
        expect(params.has('date')).toBe(false)
      })
      expect(
        await screen.findByText(
          'Courts with a free slot from Wed, Jan 9 to Thu, Jan 10.',
        ),
      ).toBeInTheDocument()

      const card = screen.getByRole('article', { name: 'Court 1 - Guga' })
      expect(within(card).getByText('Open tomorrow')).toBeInTheDocument()
      expect(within(card).getByText('Open on Thu, Jan 10')).toBeInTheDocument()
      expect(
        within(card).getByRole('list', {
          name: 'Open slots for Court 1 - Guga on Thu, Jan 10',
        }),
      ).toContainElement(
        within(card).getByRole('button', {
          name: 'Book Court 1 - Guga on Thu, Jan 10, 08:00–09:00',
        }),
      )
      expect(within(card).getByRole('note')).toHaveTextContent(
        'Thu, Jan 10 · Maintenance · Line repainting',
      )
    })

    it('limits the calendars to today and a 7-day range', async () => {
      const user = userEvent.setup()
      mockCourtsApi()

      renderPage('/courts?from=2030-01-09')
      await screen.findByRole('article', { name: 'Court 1 - Guga' })

      const dateCalendar = await openCalendar(user, 'Date')
      expect(
        within(dateCalendar).getByRole('button', { name: '2030-01-07' }),
      ).toBeDisabled()
      expect(
        within(dateCalendar).getByRole('button', { name: '2030-01-08' }),
      ).toBeEnabled()
      expect(
        within(dateCalendar).getByRole('button', { name: '2030-01-09' }),
      ).toHaveAttribute('aria-pressed', 'true')
      await user.keyboard('{Escape}')

      const endCalendar = await openCalendar(user, 'End date')
      expect(
        within(endCalendar).getByRole('button', { name: '2030-01-08' }),
      ).toBeDisabled()
      expect(
        within(endCalendar).getByRole('button', { name: '2030-01-09' }),
      ).toBeEnabled()
      expect(
        within(endCalendar).getByRole('button', { name: '2030-01-15' }),
      ).toBeEnabled()
      expect(
        within(endCalendar).getByRole('button', { name: '2030-01-16' }),
      ).toBeDisabled()
    })

    it('filters by a time window, up to midnight', async () => {
      const user = userEvent.setup()
      const fetchMock = mockCourtsApi()

      renderPage()
      await screen.findByRole('article', { name: 'Court 1 - Guga' })

      await user.click(screen.getByRole('button', { name: 'Earliest start' }))
      await user.click(screen.getByRole('option', { name: '18:00' }))
      await user.click(screen.getByRole('button', { name: 'Latest end' }))
      await user.click(screen.getByRole('option', { name: '24:00' }))

      await waitFor(() => {
        const params = lastRequest(fetchMock)
        expect(params.get('time_from')).toBe('18:00')
        expect(params.get('time_to')).toBe('24:00')
      })
      expect(
        await screen.findByText('Courts with a free slot today between 18:00 and 24:00.'),
      ).toBeInTheDocument()
      expect(pageSearch().get('time_from')).toBe('18:00')
    })
  })

  describe('validation', () => {
    it('explains invalid filters instead of calling the API', async () => {
      const user = userEvent.setup()
      const fetchMock = mockCourtsApi()

      // The calendars can't produce a range this long, but a stale or hand-edited link can.
      renderPage('/courts?from=2030-01-09&to=2030-01-20')

      expect(
        await screen.findByText('Ranges can span up to 7 days (until Tue, Jan 15).'),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('End date')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Fix the highlighted filters to see courts.',
      )
      expect(screen.queryByRole('article')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()

      await pickDate(user, 'End date', '2030-01-12')

      await waitFor(() =>
        expect(lastRequest(fetchMock).get('date_to')).toBe('2030-01-12'),
      )
      expect(
        await screen.findByRole('article', { name: 'Court 1 - Guga' }),
      ).toBeInTheDocument()
      expect(screen.queryByText(/Ranges can span/)).not.toBeInTheDocument()
    })

    it('flags a start date picked after the end date', async () => {
      const user = userEvent.setup()
      const fetchMock = mockCourtsApi()

      renderPage('/courts?from=2030-01-09&to=2030-01-10')
      await screen.findByRole('article', { name: 'Court 1 - Guga' })
      const requestsBefore = fetchMock.mock.calls.length

      await pickDate(user, 'Date', '2030-01-12')

      expect(
        await screen.findByText('Must be on or after the start date.'),
      ).toBeInTheDocument()
      expect(fetchMock.mock.calls.length).toBe(requestsBefore)
    })

    it.each([
      ['a past date', '/courts?from=2030-01-07', 'Date', 'Pick today or a later date.'],
      [
        'an end date alone',
        '/courts?to=2030-01-10',
        'Date',
        'Pick a start date for the range.',
      ],
      [
        'a reversed range',
        '/courts?from=2030-01-10&to=2030-01-09',
        'End date',
        'Must be on or after the start date.',
      ],
      [
        'a reversed time window',
        '/courts?time_from=20:00&time_to=19:00',
        'Latest end',
        'Must be after the earliest start.',
      ],
    ])('flags %s', async (_case, route, field, message) => {
      const fetchMock = mockCourtsApi()

      renderPage(route)

      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(screen.getByLabelText(field)).toHaveAttribute('aria-invalid', 'true')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('shows API validation errors on the matching filter', async () => {
      const user = userEvent.setup()
      mockCourtsApi((params) =>
        params.has('date')
          ? jsonResponse({ date: ['Dates in the past are not allowed.'] }, 400)
          : jsonResponse(makePage(ALL_COURTS)),
      )

      // Passes the browser's check, but the API's "today" is already tomorrow.
      renderPage('/courts?from=2030-01-08')

      expect(
        await screen.findByText('Dates in the past are not allowed.'),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('Date')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('alert')).toHaveTextContent(
        "CourtControl couldn't use these filters",
      )
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()

      const results = screen.getAllByRole('button', { name: 'Clear filters' })
      await user.click(results.at(-1)!)

      expect(
        await screen.findByRole('article', { name: 'Court 1 - Guga' }),
      ).toBeInTheDocument()
      expect(pageSearch().toString()).toBe('')
      expect(
        screen.queryByText('Dates in the past are not allowed.'),
      ).not.toBeInTheDocument()
    })

    it('shows API errors that belong to no field in the panel', async () => {
      mockCourtsApi(() =>
        jsonResponse(
          { non_field_errors: ['Use either `date` or `date_from`/`date_to`, not both.'] },
          400,
        ),
      )

      renderPage('/courts?from=2030-01-09')

      const filters = screen.getByRole('region', { name: 'Filters' })
      expect(
        await within(filters).findByText(
          'Use either date or date_from/date_to, not both.',
        ),
      ).toBeInTheDocument()
    })
  })

  describe('results', () => {
    it('offers to clear filters when nothing matches', async () => {
      const user = userEvent.setup()
      mockCourtsApi((params) =>
        params.has('surface_type')
          ? jsonResponse(makePage([]))
          : jsonResponse(makePage(ALL_COURTS)),
      )

      renderPage('/courts?surface=SYNTHETIC')

      expect(
        await screen.findByRole('heading', { name: 'No courts match' }),
      ).toBeInTheDocument()
      expect(screen.getByText(/try other filters/i)).toBeInTheDocument()

      const clearButtons = screen.getAllByRole('button', { name: 'Clear filters' })
      expect(clearButtons).toHaveLength(2) // panel + empty state
      await user.click(clearButtons[1])

      await waitFor(() => expect(courtNames()).toHaveLength(3))
      expect(pageSearch().toString()).toBe('')
    })

    it('explains that courts without a free slot are hidden for a time window', async () => {
      mockCourtsApi(() => jsonResponse(makePage([])))

      renderPage('/courts?time_from=06:00&time_to=07:00')

      expect(
        await screen.findByRole('heading', { name: 'No courts match' }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/no court has a free slot in that window/i),
      ).toBeInTheDocument()
    })

    it('applies filters from the URL, ignoring values it cannot use', async () => {
      const fetchMock = mockCourtsApi((params) =>
        params.get('club')
          ? only((court) => court.club.id === JARDINS.id)
          : only(() => true),
      )

      renderPage(
        `/courts?surface=grass,MUD&setting=maybe&club=${JARDINS.id},not-a-uuid&from=2030-01-09&time_from=18:00`,
      )

      expect(
        await screen.findByRole('article', { name: 'Grass Court' }),
      ).toBeInTheDocument()
      expect(requestedUrls(fetchMock)[0]).toBe(
        `/api/v1/courts/?surface_type=GRASS&club=${JARDINS.id}&date=2030-01-09&time_from=18%3A00`,
      )
      expect(screen.getByRole('checkbox', { name: 'Grass' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
      expect(screen.getByRole('button', { name: 'Date' })).toHaveTextContent(
        'Wed, Jan 9, 2030',
      )
      expect(screen.getByRole('button', { name: 'Earliest start' })).toHaveTextContent(
        '18:00',
      )
      // Named from the results even before the club list loads.
      expect(screen.getByRole('button', { name: 'Clubs' })).toHaveTextContent(
        'Jardins Country Club',
      )
      expect(screen.getByLabelText('4 active')).toBeInTheDocument()
    })

    it('keeps the current list visible while new results load', async () => {
      const user = userEvent.setup()
      let release: (response: Response) => void = () => {}
      mockCourtsApi((params) =>
        params.has('surface_type')
          ? new Promise<Response>((resolve) => {
              release = resolve
            })
          : jsonResponse(makePage(ALL_COURTS)),
      )

      renderPage()
      await screen.findByRole('article', { name: 'Grass Court' })

      await user.click(screen.getByRole('checkbox', { name: 'Grass' }))

      expect(await screen.findByRole('status')).toHaveTextContent('Updating courts…')
      expect(courtNames()).toHaveLength(3)

      release(only((court) => court.surface_type === 'GRASS'))

      await waitFor(() => expect(courtNames()).toEqual(['Grass Court']))
      expect(screen.queryByText('Updating courts…')).not.toBeInTheDocument()
    })

    it('clears every filter from the panel', async () => {
      const user = userEvent.setup()
      const fetchMock = mockCourtsApi()

      renderPage(`/courts?surface=CLAY&setting=indoor&from=2030-01-09&time_to=12:00`)
      await screen.findByRole('article', { name: 'Court 1 - Guga' })

      const filters = screen.getByRole('region', { name: 'Filters' })
      await user.click(within(filters).getByRole('button', { name: 'Clear filters' }))

      await waitFor(() => expect(lastRequest(fetchMock).toString()).toBe(''))
      expect(pageSearch().toString()).toBe('')
      expect(within(filters).getByRole('checkbox', { name: 'All' })).toBeChecked()
      expect(screen.getByRole('button', { name: 'Date' })).toHaveTextContent('Today')
      expect(
        within(filters).queryByRole('button', { name: 'Clear filters' }),
      ).not.toBeInTheDocument()
    })
  })

  it('collapses the panel on small screens, but never hides errors', async () => {
    const user = userEvent.setup()
    mockCourtsApi()

    renderPage()
    await screen.findByRole('article', { name: 'Court 1 - Guga' })

    const toggle = screen.getByRole('button', { name: 'Show' })
    const body = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(body).toHaveClass('hidden') // `sm:block` keeps it open from the sm breakpoint up

    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(body).not.toHaveClass('hidden')
    await user.click(screen.getByRole('button', { name: 'Hide' }))
    expect(body).toHaveClass('hidden')

    // An invalid filter forces the panel open so the message is visible.
    await user.click(screen.getByRole('button', { name: 'Show' }))
    await pickDate(user, 'End date', '2030-01-10')
    await user.click(screen.getByRole('button', { name: 'Hide' }))
    expect(
      await screen.findByText('Pick a start date for the range.'),
    ).toBeInTheDocument()
    expect(body).not.toHaveClass('hidden')
    expect(screen.getByRole('button', { name: 'Hide' })).toBeDisabled()
  })

  it('keeps the club-local today when the club is in another timezone', async () => {
    // 23:30 in São Paulo is already tomorrow in Lisbon.
    freezeDate('2030-01-08T23:30:00-03:00')
    const lisboa = makeClub({ name: 'Lisboa Tennis Club', timezone: 'Europe/Lisbon' })
    mockCourtsApi(() =>
      jsonResponse(
        makePage([
          makeCourt({
            name: 'Campo 1',
            club: lisboa,
            available_slots: [
              { start: '2030-01-09T08:00:00+00:00', end: '2030-01-09T09:00:00+00:00' },
            ],
          }),
          makeCourt({ name: 'Court 1 - Guga', club: IBIRAPUERA }),
        ]),
      ),
    )

    renderPage()

    const campo = await screen.findByRole('article', { name: 'Campo 1' })
    expect(within(campo).getByText('Open today')).toBeInTheDocument()
  })
})
