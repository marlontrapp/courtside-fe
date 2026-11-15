import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/client'
import { courtErrors, normalizeMoney } from '@/pages/admin/courtErrors'

describe('normalizeMoney', () => {
  it('accepts plain and decimal amounts', () => {
    expect(normalizeMoney('120')).toBe('120.00')
    expect(normalizeMoney('120.5')).toBe('120.50')
    expect(normalizeMoney(' 30.00 ')).toBe('30.00')
    expect(normalizeMoney('12,5')).toBe('12.50')
  })

  it('rejects negatives and junk', () => {
    expect(normalizeMoney('-1')).toBeNull()
    expect(normalizeMoney('abc')).toBeNull()
    expect(normalizeMoney('1.234')).toBeNull()
    expect(normalizeMoney('')).toBeNull()
  })
})

describe('courtErrors', () => {
  it('lists the bookings deactivating would cancel', () => {
    const booking = {
      id: 'r1',
      court_name: 'Court 1',
      start: '2030-01-09T18:00:00-03:00',
      end: '2030-01-09T19:00:00-03:00',
      primary_player: { id: 'p1', first_name: 'Ana', last_name: 'Silva' },
      status: 'CONFIRMED',
    }
    expect(
      courtErrors(
        new ApiError('x', 409, {}, { conflicting_reservations: [booking] }),
      ),
    ).toMatchObject({
      conflicts: [{ id: 'r1' }],
      general: expect.stringMatching(/1 future booking/),
    })
  })

  it('flags booking history vs linked rules on delete', () => {
    expect(
      courtErrors(new ApiError('Deactivate it instead.', 409)),
    ).toMatchObject({ hasBookings: true })
    expect(
      courtErrors(new ApiError('Unlink it from the rule(s) first.', 409)),
    ).toMatchObject({ linkedRules: true })
  })

  it('maps field validation', () => {
    expect(
      courtErrors(
        new ApiError('Bad', 400, {
          name: ['This club already has a court with this name.'],
        }),
      ),
    ).toEqual({
      name: 'This club already has a court with this name.',
    })
  })
})
