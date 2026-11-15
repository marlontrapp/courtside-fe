import { beforeEach, describe, expect, it } from 'vitest'

import {
  conflictingBookings,
  createClubCourt,
  createCourtSchedule,
  createDayTemplate,
  currentSchedule,
  deleteClubCourt,
  deleteDayTemplate,
  fetchClub,
  fetchClubCourts,
  fetchCourtSchedules,
  fetchDayTemplates,
  groupDayTemplates,
  scheduleDayTemplates,
  sharedDayTemplate,
  updateClubCourt,
  updateDayTemplate,
} from '@/api/clubs'
import { ApiError } from '@/api/client'
import { jsonResponse, mockFetch } from '@/test/fetch'

const template = {
  id: 't1',
  name: 'Weekdays',
  slots: [{ start: '07:00', end: '08:00' }],
  locked: false,
  created_at: '2030-01-01T10:00:00-03:00',
  updated_at: '2030-01-01T10:00:00-03:00',
}

const calls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.map(([input, init]) => ({
    url: String(input),
    method: init?.method ?? 'GET',
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }))

describe('clubs API', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=test-csrf-token'
  })

  it('reads a club', async () => {
    const club = {
      id: 'c1',
      name: 'Jardins',
      slug: 'jardins',
      address: 'Rua X',
      timezone: 'America/Sao_Paulo',
      access_type: 'MEMBERS_ONLY',
      cancellation_window_hours: 24,
      is_active: true,
      created_at: 'x',
      updated_at: 'y',
    }
    const fetchMock = mockFetch(() => jsonResponse(club))

    await expect(fetchClub('c1')).resolves.toMatchObject({
      id: 'c1',
      cancellation_window_hours: 24,
    })
    expect(calls(fetchMock)[0].url).toBe('/api/v1/clubs/c1/')
  })

  it('lists, creates, updates and deletes day templates', async () => {
    const fetchMock = mockFetch((_url, init) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      if (init?.method === 'PATCH') {
        return jsonResponse({ ...template, name: 'Workdays', cancelled_reservations: [] })
      }
      if (init?.method === 'POST') return jsonResponse(template, 201)
      return jsonResponse([template])
    })

    await expect(fetchDayTemplates('c1')).resolves.toEqual([
      { id: 't1', name: 'Weekdays', slots: template.slots, locked: false },
    ])
    await createDayTemplate('c1', { name: 'Weekdays', slots: template.slots })
    await expect(updateDayTemplate('c1', 't1', { name: 'Workdays' })).resolves.toEqual({
      template: { id: 't1', name: 'Workdays', slots: template.slots, locked: false },
      cancelled: [],
    })
    await deleteDayTemplate('c1', 't1')

    expect(calls(fetchMock)).toEqual([
      { url: '/api/v1/clubs/c1/day-templates/', method: 'GET', body: undefined },
      {
        url: '/api/v1/clubs/c1/day-templates/',
        method: 'POST',
        body: { name: 'Weekdays', slots: template.slots },
      },
      {
        url: '/api/v1/clubs/c1/day-templates/t1/',
        method: 'PATCH',
        body: { name: 'Workdays' },
      },
      { url: '/api/v1/clubs/c1/day-templates/t1/', method: 'DELETE', body: undefined },
    ])
  })

  it('lists, creates, updates and deletes club courts', async () => {
    const court = {
      id: 'court-1',
      name: 'Court 1',
      surface_type: 'CLAY',
      is_indoor: false,
      is_singles_only: true,
      has_lighting: true,
      hourly_rate: '120.00',
      lighting_fee: '30.00',
      is_active: true,
      created_at: '2030-01-01T10:00:00-03:00',
      updated_at: '2030-01-01T10:00:00-03:00',
    }
    const fetchMock = mockFetch((_url, init) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      if (init?.method === 'PATCH') {
        return jsonResponse({
          ...court,
          name: 'Court One',
          cancelled_reservations: [],
        })
      }
      if (init?.method === 'POST') return jsonResponse(court, 201)
      return jsonResponse([court])
    })

    await expect(fetchClubCourts('c1')).resolves.toEqual([court])
    await createClubCourt('c1', {
      name: 'Court 1',
      surface_type: 'CLAY',
      is_indoor: false,
      is_singles_only: true,
      has_lighting: true,
      hourly_rate: '120.00',
      lighting_fee: '30.00',
      is_active: true,
    })
    await expect(updateClubCourt('c1', 'court-1', { name: 'Court One' })).resolves.toEqual({
      court: { ...court, name: 'Court One' },
      cancelled: [],
    })
    await deleteClubCourt('c1', 'court-1')
    await deleteClubCourt('c1', 'court-1', { force: true })

    expect(calls(fetchMock)).toEqual([
      { url: '/api/v1/clubs/c1/courts/', method: 'GET', body: undefined },
      {
        url: '/api/v1/clubs/c1/courts/',
        method: 'POST',
        body: {
          name: 'Court 1',
          surface_type: 'CLAY',
          is_indoor: false,
          is_singles_only: true,
          has_lighting: true,
          hourly_rate: '120.00',
          lighting_fee: '30.00',
          is_active: true,
        },
      },
      {
        url: '/api/v1/clubs/c1/courts/court-1/',
        method: 'PATCH',
        body: { name: 'Court One' },
      },
      { url: '/api/v1/clubs/c1/courts/court-1/', method: 'DELETE', body: undefined },
      {
        url: '/api/v1/clubs/c1/courts/court-1/?force=true',
        method: 'DELETE',
        body: undefined,
      },
    ])
  })

  it('lists and creates court schedules', async () => {
    const schedule = {
      id: 's1',
      valid_from: '2030-01-08',
      valid_until: null,
      state: 'current',
      days: [
        {
          weekdays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
          day_template: { id: 't1', name: 'Weekdays' },
        },
        {
          weekdays: ['SATURDAY', 'SUNDAY'],
          day_template: null,
        },
      ],
    }
    const fetchMock = mockFetch((_url, init) => {
      if (init?.method === 'POST') {
        return jsonResponse({ ...schedule, cancelled_reservations: [] }, 201)
      }
      return jsonResponse([schedule])
    })

    await expect(fetchCourtSchedules('court-1')).resolves.toEqual([schedule])
    await expect(
      createCourtSchedule('court-1', {
        valid_from: '2030-01-08',
        days: [
          {
            weekdays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
            day_template: 't1',
          },
          { weekdays: ['SATURDAY', 'SUNDAY'], day_template: null },
        ],
      }),
    ).resolves.toEqual({ schedule, cancelled: [] })

    expect(calls(fetchMock)).toEqual([
      { url: '/api/v1/courts/court-1/schedules/', method: 'GET', body: undefined },
      {
        url: '/api/v1/courts/court-1/schedules/',
        method: 'POST',
        body: {
          valid_from: '2030-01-08',
          days: [
            {
              weekdays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
              day_template: 't1',
            },
            { weekdays: ['SATURDAY', 'SUNDAY'], day_template: null },
          ],
        },
      },
    ])
  })

  it('maps and groups per-weekday day templates', () => {
    const schedule = {
      id: 's1',
      valid_from: '2030-01-08',
      valid_until: null,
      state: 'current',
      days: [
        {
          weekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
          day_template: { id: 't1', name: 'Weekdays' },
        },
        {
          weekdays: ['TUESDAY', 'THURSDAY'],
          day_template: { id: 't2', name: 'Evening' },
        },
        {
          weekdays: ['SATURDAY', 'SUNDAY'],
          day_template: null,
        },
      ],
    }
    expect(currentSchedule([schedule, { ...schedule, id: 's0', state: 'past' }])).toEqual(
      schedule,
    )
    const byDay = scheduleDayTemplates(schedule)
    expect(byDay).toMatchObject({
      MONDAY: 't1',
      TUESDAY: 't2',
      WEDNESDAY: 't1',
      THURSDAY: 't2',
      FRIDAY: 't1',
      SATURDAY: '',
      SUNDAY: '',
    })
    expect(sharedDayTemplate(byDay)).toBeNull()
    expect(groupDayTemplates(byDay)).toEqual([
      {
        weekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
        day_template: 't1',
      },
      {
        weekdays: ['TUESDAY', 'THURSDAY'],
        day_template: 't2',
      },
      {
        weekdays: ['SATURDAY', 'SUNDAY'],
        day_template: null,
      },
    ])
  })

  it('reads the bookings a 409 lists', () => {
    const booking = {
      id: 'r1',
      court: 'c',
      court_name: 'Court 1',
      start: 's',
      end: 'e',
      primary_player: { id: 'p1', first_name: 'Ana', last_name: 'Silva' },
      status: 'CONFIRMED',
    }
    expect(
      conflictingBookings(
        new ApiError('x', 409, {}, { conflicting_reservations: [booking] }),
      ),
    ).toEqual([
      {
        id: 'r1',
        court_name: 'Court 1',
        start: 's',
        end: 'e',
        primary_player: { id: 'p1', first_name: 'Ana', last_name: 'Silva' },
        status: 'CONFIRMED',
      },
    ])
    expect(conflictingBookings(new ApiError('x', 409, {}, { detail: 'locked' }))).toEqual(
      [],
    )
    expect(conflictingBookings(new ApiError('x', 400))).toEqual([])
  })
})
