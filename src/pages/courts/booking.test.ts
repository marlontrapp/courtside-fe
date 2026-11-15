import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/client'
import {
  bookingErrors,
  buildReservationRequest,
  endOptions,
  endTimeFor,
  estimateTotal,
  formatDuration,
  type BookingFormValues,
} from '@/pages/courts/booking'
import { makeCourt } from '@/test/factories'

const slot = (start: string, end: string) => ({
  start: `2030-01-08T${start}:00-03:00`,
  end: `2030-01-08T${end}:00-03:00`,
})

const VALUES: BookingFormValues = {
  end: '2030-01-08T19:00:00-03:00',
  bookingType: 'SINGLES',
  includesLighting: false,
  guests: [],
  notes: '',
}

describe('endOptions', () => {
  it('offers every consecutive free slot as an end, stopping at a gap', () => {
    const court = makeCourt({
      available_slots: [
        slot('17:00', '18:00'),
        slot('18:00', '19:00'),
        slot('19:00', '20:30'),
        // 20:30–21:00 is booked
        slot('21:00', '22:00'),
      ],
    })

    expect(endOptions(court, court.available_slots[0])).toEqual([
      { end: '2030-01-08T18:00:00-03:00', slots: 1, minutes: 60 },
      { end: '2030-01-08T19:00:00-03:00', slots: 2, minutes: 120 },
      { end: '2030-01-08T20:30:00-03:00', slots: 3, minutes: 210 },
    ])
    expect(endOptions(court, court.available_slots[3])).toHaveLength(1)
  })

  it('starts from the clicked slot, whatever the list order', () => {
    const court = makeCourt({
      available_slots: [
        slot('19:00', '20:00'),
        slot('17:00', '18:00'),
        slot('18:00', '19:00'),
      ],
    })

    expect(
      endOptions(court, slot('18:00', '19:00')).map((option) => option.minutes),
    ).toEqual([60, 120])
  })

  it('never continues into the next day', () => {
    const court = makeCourt({
      available_slots: [
        { start: '2030-01-08T23:00:00-03:00', end: '2030-01-09T00:00:00-03:00' },
        { start: '2030-01-09T00:00:00-03:00', end: '2030-01-09T01:00:00-03:00' },
      ],
    })

    expect(endOptions(court, court.available_slots[0])).toHaveLength(1)
  })

  it('falls back to the clicked slot alone if it is no longer listed', () => {
    const court = makeCourt({ available_slots: [] })

    expect(endOptions(court, slot('17:00', '18:30'))).toEqual([
      { end: '2030-01-08T18:30:00-03:00', slots: 1, minutes: 90 },
    ])
  })
})

describe('formatDuration', () => {
  it('uses minutes for slot-sized durations, then hours', () => {
    expect(formatDuration(30)).toBe('30 min')
    expect(formatDuration(60)).toBe('60 min')
    expect(formatDuration(90)).toBe('90 min')
    expect(formatDuration(120)).toBe('2 h')
    expect(formatDuration(150)).toBe('2 h 30 min')
  })
})

describe('endTimeFor', () => {
  it('uses the wall-clock end time', () => {
    expect(endTimeFor('2030-01-08T18:00:00-03:00', '2030-01-08T19:30:00-03:00')).toBe(
      '19:30',
    )
  })

  it('sends a midnight end as 24:00 on the start date', () => {
    expect(endTimeFor('2030-01-08T23:00:00-03:00', '2030-01-09T00:00:00-03:00')).toBe(
      '24:00',
    )
  })
})

describe('buildReservationRequest', () => {
  it('maps the slot and form to the API body (club-local date and times)', () => {
    const court = makeCourt({ id: 'court-1' })

    expect(
      buildReservationRequest(court, slot('18:00', '19:00'), {
        ...VALUES,
        end: '2030-01-08T20:00:00-03:00',
        bookingType: 'DOUBLES',
        includesLighting: true,
        guests: [
          { email: ' ana@example.com ' },
          { email: '' },
          { email: 'bruno@example.com' },
        ],
        notes: '  Bring balls  ',
      }),
    ).toEqual({
      court: 'court-1',
      date: '2030-01-08',
      start_time: '18:00',
      end_time: '20:00',
      booking_type: 'DOUBLES',
      includes_lighting: true,
      guests: ['ana@example.com', 'bruno@example.com'],
      notes: 'Bring balls',
    })
  })

  it('never asks for lighting on a court without it', () => {
    const court = makeCourt({ has_lighting: false })

    expect(
      buildReservationRequest(court, slot('18:00', '19:00'), {
        ...VALUES,
        includesLighting: true,
      }).includes_lighting,
    ).toBe(false)
  })
})

describe('estimateTotal', () => {
  it("matches CourtControl's rate × hours (+ lighting fee × hours)", () => {
    const court = makeCourt({ hourly_rate: '120.00', lighting_fee: '30.00' })

    expect(estimateTotal(court, 60, false)).toBe(120)
    expect(estimateTotal(court, 90, false)).toBe(180)
    expect(estimateTotal(court, 120, true)).toBe(300)
  })

  it('ignores lighting on a court without it, and has no total without a rate', () => {
    expect(estimateTotal(makeCourt({ has_lighting: false }), 60, true)).toBe(120)
    expect(estimateTotal(makeCourt({ hourly_rate: '0.00' }), 60, false)).toBeNull()
  })
})

describe('bookingErrors', () => {
  it('treats 409 as a taken slot', () => {
    expect(bookingErrors(new ApiError('x', 409))).toEqual({
      general: 'That slot was just taken. Pick another time.',
      conflict: true,
    })
  })

  it('puts guest and notes errors on their fields', () => {
    expect(
      bookingErrors(
        new ApiError('x', 400, {
          guests: ['No registered player with email: nobody@example.com.'],
          notes: ['Ensure this field has no more than 500 characters.'],
        }),
      ),
    ).toEqual({
      guests: 'No registered player with email: nobody@example.com.',
      notes: 'Ensure this field has no more than 500 characters.',
    })
  })

  it('shows booking-rule errors as a general message', () => {
    expect(
      bookingErrors(
        new ApiError('x', 400, {
          non_field_errors: ['Cannot book a slot in the past.', 'Court is not active.'],
        }),
      ),
    ).toEqual({ general: 'Cannot book a slot in the past. Court is not active.' })
    expect(
      bookingErrors(
        new ApiError('x', 400, { end_time: ['Must be after `start_time`.'] }),
      ),
    ).toEqual({ general: 'Must be after start_time.' })
  })

  it('explains a court the user can no longer book', () => {
    expect(
      bookingErrors(
        new ApiError('x', 400, { court: ['Invalid pk "…" - object does not exist.'] }),
      ),
    ).toEqual({ general: 'This court is no longer available to you.' })
  })

  it('handles sessions, servers, networks and the unknown', () => {
    expect(bookingErrors(new ApiError('x', 403))).toMatchObject({ sessionExpired: true })
    expect(bookingErrors(new ApiError('x', 502)).general).toMatch(/\(502\)/)
    expect(bookingErrors(new TypeError('Failed to fetch')).general).toMatch(
      /can't reach/i,
    )
    expect(bookingErrors(new Error('boom')).general).toMatch(/something went wrong/i)
    expect(bookingErrors(new ApiError('Bad request', 400))).toEqual({
      general: 'Bad request',
    })
  })
})
