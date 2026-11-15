import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/client'
import {
  QUARTER_ENDS,
  QUARTER_STARTS,
  fromMinutes,
  gridSlots,
  nextSlot,
  sortSlots,
  summarizeSlots,
  templateErrors,
  toMinutes,
  validateSlots,
} from '@/pages/admin/templateSlots'

const slot = (start: string, end: string) => ({ start, end })

describe('times', () => {
  it('converts between HH:MM and minutes, midnight as 24:00', () => {
    expect(toMinutes('06:30')).toBe(390)
    expect(toMinutes('24:00')).toBe(1440)
    expect(fromMinutes(1440)).toBe('24:00')
    expect(fromMinutes(5)).toBe('00:05')
  })

  it('offers quarter hours, ends up to midnight', () => {
    expect(QUARTER_STARTS).toHaveLength(96)
    expect(QUARTER_STARTS.at(-1)).toBe('23:45')
    expect(QUARTER_ENDS[0]).toBe('00:15')
    expect(QUARTER_ENDS.at(-1)).toBe('24:00')
  })
})

describe('gridSlots', () => {
  it("fills the day like CourtControl's grid_slots", () => {
    expect(gridSlots('09:00', '13:00', 90)).toEqual([
      slot('09:00', '10:30'),
      slot('10:30', '12:00'),
    ])
    expect(gridSlots('22:00', '24:00', 60)).toEqual([
      slot('22:00', '23:00'),
      slot('23:00', '24:00'),
    ])
    expect(gridSlots('09:00', '09:30', 60)).toEqual([])
    expect(gridSlots('09:00', '13:00', 0)).toEqual([])
  })
})

describe('nextSlot', () => {
  it('follows the last slot with the same length', () => {
    expect(nextSlot([slot('09:00', '10:30'), slot('07:00', '08:00')])).toEqual(
      slot('10:30', '12:00'),
    )
    expect(nextSlot([])).toEqual(slot('08:00', '09:00'))
  })

  it('stops at midnight', () => {
    expect(nextSlot([slot('23:00', '23:45')])).toEqual(slot('23:45', '24:00'))
    expect(nextSlot([slot('23:00', '24:00')])).toBeNull()
  })
})

describe('validateSlots', () => {
  it('accepts back-to-back slots in any order', () => {
    expect(validateSlots([slot('10:00', '11:00'), slot('09:00', '10:00')])).toEqual({})
  })

  it('flags slots ending before they start and overlaps, by index', () => {
    expect(
      validateSlots([
        slot('09:00', '10:30'),
        slot('12:00', '11:00'),
        slot('10:00', '11:00'),
      ]),
    ).toEqual({ 1: 'Must end after it starts.', 2: 'Overlaps 09:00–10:30.' })
  })
})

describe('summaries', () => {
  it('describes the day', () => {
    expect(summarizeSlots([slot('09:00', '10:00'), slot('07:00', '08:00')])).toBe(
      '2 slots · 07:00–10:00 · 60 min each',
    )
    expect(summarizeSlots([slot('09:00', '10:30'), slot('10:30', '11:00')])).toBe(
      '2 slots · 09:00–11:00',
    )
    expect(summarizeSlots([])).toMatch(/^No slots/)
  })

  it('sorts slots by start', () => {
    expect(
      sortSlots([slot('10:00', '11:00'), slot('08:00', '09:00')]).map((s) => s.start),
    ).toEqual(['08:00', '10:00'])
  })
})

describe('templateErrors', () => {
  it('puts name and slot errors on their fields', () => {
    expect(
      templateErrors(
        new ApiError('x', 400, {
          name: ['This club already has a day template with this name.'],
          slots: ['09:00–10:00 overlaps 09:30–10:30.'],
        }),
      ),
    ).toEqual({
      name: 'This club already has a day template with this name.',
      slots: '09:00–10:00 overlaps 09:30–10:30.',
    })
  })

  it('lists the bookings a change would cancel (409)', () => {
    const booking = {
      id: 'r1',
      court: 'c1',
      court_name: 'Court 1',
      start: '2030-01-09T18:00:00-03:00',
      end: '2030-01-09T19:00:00-03:00',
      primary_player: { id: 'p1', first_name: 'Ana', last_name: 'Silva' },
      status: 'CONFIRMED',
    }
    expect(
      templateErrors(
        new ApiError(
          '1 future booking(s) wouldn’t fit the new schedule.',
          409,
          {},
          {
            detail: '1 future booking(s) wouldn’t fit the new schedule.',
            conflicting_reservations: [booking],
            hint: 'Pick a later start date, or send force=true to cancel these bookings.',
          },
        ),
      ),
    ).toMatchObject({
      general: '1 future booking doesn’t fit the new slots.',
      conflicts: [
        {
          id: 'r1',
          court_name: 'Court 1',
          primary_player: { id: 'p1', first_name: 'Ana', last_name: 'Silva' },
        },
      ],
    })
  })

  it('passes on other 409s (locked, in use) and marks the list stale', () => {
    expect(
      templateErrors(
        new ApiError(
          "This template is used by a schedule or an override, so it can't be deleted.",
          409,
        ),
      ),
    ).toEqual({
      general:
        "This template is used by a schedule or an override, so it can't be deleted.",
      stale: true,
    })
  })

  it('handles gone templates, servers, networks and sessions', () => {
    expect(templateErrors(new ApiError('Not found.', 404))).toMatchObject({ stale: true })
    expect(templateErrors(new ApiError('x', 503)).general).toMatch(/\(503\)/)
    expect(templateErrors(new TypeError('Failed to fetch')).general).toMatch(
      /can't reach/i,
    )
    expect(templateErrors(new ApiError('x', 403))).toMatchObject({ sessionExpired: true })
  })
})
