import { describe, expect, it } from 'vitest'

import {
  cancelReservation,
  createReservation,
  fetchUpcomingReservations,
} from '@/api/reservations'
import { makeReservation, makeReservationPage } from '@/test/factories'
import { jsonResponse, mockFetch, requestedUrls } from '@/test/fetch'

describe('fetchUpcomingReservations', () => {
  it('asks for unfinished bookings (incl. unpaid holds), soonest first', async () => {
    const page = makeReservationPage([makeReservation()])
    const fetchMock = mockFetch(() => jsonResponse(page))

    await expect(fetchUpcomingReservations()).resolves.toEqual(page)
    await fetchUpcomingReservations(3)

    expect(requestedUrls(fetchMock)).toEqual([
      '/api/v1/reservations/?state=upcoming%2Cpending_payment&ordering=start',
      '/api/v1/reservations/?state=upcoming%2Cpending_payment&ordering=start&page=3',
    ])
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' })
  })

  it('rejects a payload that is not a reservations page', async () => {
    mockFetch(() => jsonResponse({ results: 'nope' }))
    await expect(fetchUpcomingReservations()).rejects.toThrow(
      /unexpected reservations response/i,
    )

    mockFetch(() => new Response('<html></html>', { status: 200 }))
    await expect(fetchUpcomingReservations()).rejects.toThrow(
      /unexpected reservations response/i,
    )
  })

  it('rejects the legacy email-string player shape from older CourtControl', async () => {
    const page = makeReservationPage([makeReservation()])
    mockFetch(() =>
      jsonResponse({
        ...page,
        results: [
          {
            ...page.results[0],
            primary_player: 'player@example.com',
            guests: ['ana@example.com'],
          },
        ],
      }),
    )
    await expect(fetchUpcomingReservations()).rejects.toThrow(
      /unexpected reservations response/i,
    )
  })
})

describe('createReservation', () => {
  it('POSTs JSON with the CSRF token and returns the booking', async () => {
    document.cookie = 'csrftoken=test-csrf-token'
    const reservation = makeReservation()
    const fetchMock = mockFetch(() => jsonResponse(reservation, 201))

    const request = {
      court: 'court-guga',
      date: '2030-01-09',
      start_time: '18:00',
      end_time: '19:00',
      booking_type: 'SINGLES' as const,
      includes_lighting: false,
      guests: [],
      notes: '',
    }
    await expect(createReservation(request)).resolves.toEqual(reservation)

    const [input, init] = fetchMock.mock.calls[0]
    expect(String(input)).toBe('/api/v1/reservations/')
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify(request) })
    expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('test-csrf-token')
  })

  it("flags a confirmation it can't read without hiding that the booking went through", async () => {
    document.cookie = 'csrftoken=test-csrf-token'
    mockFetch(() => jsonResponse({ id: 'x' }, 201))

    await expect(
      createReservation({
        court: 'c',
        date: '2030-01-09',
        start_time: '18:00',
        end_time: '19:00',
        booking_type: 'SINGLES',
        includes_lighting: false,
        guests: [],
        notes: '',
      }),
    ).rejects.toThrow(/was booked/i)
  })
})

describe('cancelReservation', () => {
  it('POSTs the trimmed reason to the cancel endpoint with the CSRF token', async () => {
    document.cookie = 'csrftoken=test-csrf-token'
    const cancelled = makeReservation({
      id: 'r 1',
      status: 'CANCELLED',
      state: 'cancelled',
    })
    const fetchMock = mockFetch(() => jsonResponse(cancelled))

    await expect(cancelReservation('r 1', '  Rain  ')).resolves.toEqual(cancelled)

    const [input, init] = fetchMock.mock.calls[0]
    expect(String(input)).toBe('/api/v1/reservations/r%201/cancel/')
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ reason: 'Rain' }),
    })
    expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('test-csrf-token')
  })

  it('surfaces the policy explanation from a 409', async () => {
    document.cookie = 'csrftoken=test-csrf-token'
    mockFetch(() =>
      jsonResponse({ detail: 'This booking has already started or finished.' }, 409),
    )

    await expect(cancelReservation('r1')).rejects.toMatchObject({
      status: 409,
      message: 'This booking has already started or finished.',
    })
  })
})
