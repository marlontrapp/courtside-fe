import { beforeEach, describe, expect, it } from 'vitest'

import { ApiError } from '@/api/client'
import {
  deleteCourtOverride,
  fetchClubOverrides,
  fetchCourtOverrides,
  setCourtOverride,
  setOverridesOnCourts,
} from '@/api/clubs'
import { jsonResponse, mockFetch } from '@/test/fetch'

const override = {
  date: '2030-01-10',
  type: 'WEATHER',
  notes: 'Rain',
  day_template: null,
  slots: [],
  created_at: '2030-01-08T10:00:00-03:00',
  updated_at: '2030-01-08T10:00:00-03:00',
}

const calls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.map(([input, init]) => ({
    url: String(input),
    method: init?.method ?? 'GET',
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }))

describe('schedule overrides API', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=test-csrf-token'
  })

  it('lists, sets and deletes overrides for a court', async () => {
    const fetchMock = mockFetch((_url, init) => {
      if (init?.method === 'DELETE') {
        return jsonResponse({ cancelled_reservations: [] })
      }
      if (init?.method === 'PUT') {
        return jsonResponse({ ...override, cancelled_reservations: [] })
      }
      return jsonResponse([override])
    })

    await expect(fetchCourtOverrides('court-1')).resolves.toEqual([override])
    await expect(
      setCourtOverride('court-1', '2030-01-10', {
        day_template: null,
        type: 'WEATHER',
        notes: 'Rain',
      }),
    ).resolves.toEqual({ override, cancelled: [] })
    await expect(deleteCourtOverride('court-1', '2030-01-10')).resolves.toEqual([])

    expect(calls(fetchMock)).toEqual([
      { url: '/api/v1/courts/court-1/overrides/', method: 'GET', body: undefined },
      {
        url: '/api/v1/courts/court-1/overrides/2030-01-10/',
        method: 'PUT',
        body: { day_template: null, type: 'WEATHER', notes: 'Rain' },
      },
      {
        url: '/api/v1/courts/court-1/overrides/2030-01-10/',
        method: 'DELETE',
        body: undefined,
      },
    ])
  })

  it('aggregates overrides across club courts', async () => {
    mockFetch((url) => {
      if (String(url).includes('court-a')) {
        return jsonResponse([{ ...override, date: '2030-01-12' }])
      }
      return jsonResponse([{ ...override, date: '2030-01-10' }])
    })

    await expect(
      fetchClubOverrides([
        { id: 'court-b', name: 'Court B' },
        { id: 'court-a', name: 'Court A' },
      ]),
    ).resolves.toEqual([
      {
        ...override,
        date: '2030-01-10',
        courtId: 'court-b',
        courtName: 'Court B',
      },
      {
        ...override,
        date: '2030-01-12',
        courtId: 'court-a',
        courtName: 'Court A',
      },
    ])
  })

  it('collects booking conflicts when applying to several courts', async () => {
    mockFetch((url, init) => {
      if (init?.method !== 'PUT') return jsonResponse([])
      if (String(url).includes('court-2')) {
        return jsonResponse(
          {
            detail: '1 future booking(s)',
            conflicting_reservations: [
              {
                id: 'r1',
                court_name: 'Court 2',
                start: 's',
                end: 'e',
                primary_player: { id: 'p1', first_name: 'Ana', last_name: 'Silva' },
                status: 'CONFIRMED',
              },
            ],
          },
          409,
        )
      }
      return jsonResponse({ ...override, cancelled_reservations: [] })
    })

    const result = await setOverridesOnCourts(['court-1', 'court-2'], '2030-01-10', {
      day_template: null,
      type: 'WEATHER',
    })

    expect(result.saved).toHaveLength(1)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.courtId).toBe('court-2')
    expect(result.failures).toHaveLength(0)
    expect(result.conflicts[0]?.error).toBeInstanceOf(ApiError)
  })
})
