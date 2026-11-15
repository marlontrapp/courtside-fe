import { beforeEach, describe, expect, it } from 'vitest'

import {
  bookingTypeLabel,
  cancelBlockedReason,
  cancellationNote,
  cancellationStatus,
  formatInstant,
  groupByMonth,
  historyStatus,
  cancellationWindowHours,
  hasEnded,
  reservationDay,
  reservationDuration,
  reservationPeople,
  reservationTimeRange,
  reservationTiming,
} from '@/pages/home/reservationFormat'
import { makeReservation } from '@/test/factories'
import { freezeDate } from '@/test/render'

const ms = (iso: string) => Date.parse(iso)

describe('reservation formatting', () => {
  beforeEach(() => freezeDate('2030-01-08T12:00:00-03:00'))

  it('labels the day relative to the club-local today', () => {
    expect(reservationDay(makeReservation({ start: '2030-01-08T18:00:00-03:00' }))).toBe(
      'Today',
    )
    expect(reservationDay(makeReservation())).toBe('Tomorrow')
    expect(reservationDay(makeReservation({ start: '2030-01-12T09:00:00-03:00' }))).toBe(
      'Sat, Jan 12',
    )
  })

  it('shows the time range and duration, with midnight as 24:00', () => {
    const late = makeReservation({
      start: '2030-01-09T22:30:00-03:00',
      end: '2030-01-10T00:00:00-03:00',
    })
    expect(reservationTimeRange(makeReservation())).toBe('18:00–19:00')
    expect(reservationTimeRange(late)).toBe('22:30–24:00')
    expect(reservationDuration(makeReservation())).toBe('60 min')
    expect(reservationDuration(late)).toBe('90 min')
  })

  it('labels booking types, including staff-only ones a guest may be in', () => {
    expect(bookingTypeLabel('DOUBLES')).toBe('Doubles')
    expect(bookingTypeLabel('TOURNAMENT')).toBe('Tournament')
  })

  it('names the other players from the user’s point of view', () => {
    expect(reservationPeople(makeReservation())).toBeNull()
    expect(
      reservationPeople(
        makeReservation({ guests: ['ana@example.com', 'bo@example.com'] }),
      ),
    ).toBe('With ana@example.com, bo@example.com')
    expect(
      reservationPeople(
        makeReservation({
          role: 'guest',
          primary_player: 'carla@example.com',
          guests: ['player@example.com'],
        }),
      ),
    ).toBe('Booked by carla@example.com')
  })
})

describe('reservationTiming', () => {
  const reservation = makeReservation({
    start: '2030-01-08T18:00:00-03:00',
    end: '2030-01-08T19:00:00-03:00',
  })

  it('flags a booking being played now', () => {
    expect(reservationTiming(reservation, ms('2030-01-08T18:00:00-03:00'))).toEqual({
      kind: 'in-progress',
    })
    expect(reservationTiming(reservation, ms('2030-01-08T18:59:00-03:00'))).toEqual({
      kind: 'in-progress',
    })
  })

  it('flags a booking starting within the hour, rounding minutes up', () => {
    expect(reservationTiming(reservation, ms('2030-01-08T17:00:00-03:00'))).toEqual({
      kind: 'soon',
      minutes: 60,
    })
    expect(reservationTiming(reservation, ms('2030-01-08T17:59:30-03:00'))).toEqual({
      kind: 'soon',
      minutes: 1,
    })
    expect(reservationTiming(reservation, ms('2030-01-08T16:59:00-03:00'))).toBeNull()
  })

  it('knows when a booking has ended', () => {
    expect(hasEnded(reservation, ms('2030-01-08T18:59:59-03:00'))).toBe(false)
    expect(hasEnded(reservation, ms('2030-01-08T19:00:00-03:00'))).toBe(true)
  })
})

describe('cancellationNote', () => {
  beforeEach(() => freezeDate('2030-01-08T12:00:00-03:00'))

  it('gives the free-cancellation deadline in the club timezone', () => {
    expect(cancellationNote(makeReservation())).toBe(
      'Free cancellation until today, 18:00.',
    )
    expect(
      cancellationNote(
        makeReservation({ cancellation_deadline: '2030-01-12T08:00:00-03:00' }),
      ),
    ).toBe('Free cancellation until Sat, Jan 12, 08:00.')
  })

  it('says nothing when the booking can no longer be cancelled (see cancelBlockedReason)', () => {
    expect(cancellationNote(makeReservation({ can_cancel: false }))).toBeNull()
  })

  it('lets unpaid holds be dropped until they start', () => {
    expect(
      cancellationNote(
        makeReservation({ state: 'pending_payment', status: 'PENDING_PAYMENT' }),
      ),
    ).toBe('Can be cancelled until it starts.')
  })

  it('says nothing to guests (only the booker can cancel)', () => {
    expect(
      cancellationNote(makeReservation({ role: 'guest', can_cancel: false })),
    ).toBeNull()
  })
})

describe('cancelBlockedReason', () => {
  const now = ms('2030-01-08T12:00:00-03:00')

  it('is null when the booking can be cancelled', () => {
    expect(cancelBlockedReason(makeReservation(), now)).toBeNull()
  })

  it("states the club's window, derived from the deadline", () => {
    // Start 2030-01-09 18:00, deadline 24 h before.
    const late = makeReservation({ can_cancel: false })
    expect(cancellationWindowHours(late)).toBe(24)
    expect(cancelBlockedReason(late, now)).toBe(
      "The club doesn't permit cancellations within 24 hours of the start of the booking.",
    )

    const strict = makeReservation({
      can_cancel: false,
      cancellation_deadline: '2030-01-07T18:00:00-03:00',
    })
    expect(cancelBlockedReason(strict, now)).toBe(
      "The club doesn't permit cancellations within 48 hours of the start of the booking.",
    )

    const oneHour = makeReservation({
      can_cancel: false,
      cancellation_deadline: '2030-01-09T17:00:00-03:00',
    })
    expect(cancelBlockedReason(oneHour, now)).toBe(
      "The club doesn't permit cancellations within 1 hour of the start of the booking.",
    )
  })

  it('tells guests to ask the booking owner, without naming them', () => {
    const reason = cancelBlockedReason(
      makeReservation({
        role: 'guest',
        primary_player: 'carla@example.com',
        can_cancel: false,
      }),
      now,
    )
    expect(reason).toBe(
      "Guests can't cancel a booking. Ask the booking owner to cancel it.",
    )
    expect(reason).not.toContain('carla@example.com')
  })

  it('explains bookings that have already started', () => {
    const playing = makeReservation({
      start: '2030-01-08T11:30:00-03:00',
      end: '2030-01-08T12:30:00-03:00',
      can_cancel: false,
    })
    expect(cancelBlockedReason(playing, now)).toBe(
      "This booking has already started, so it can't be cancelled.",
    )
  })

  it('falls back to a plain explanation when the cause is unknown', () => {
    const hold = makeReservation({
      state: 'pending_payment',
      status: 'PENDING_PAYMENT',
      can_cancel: false,
    })
    expect(cancelBlockedReason(hold, now)).toBe(
      "This booking can't be cancelled anymore.",
    )
    expect(
      cancelBlockedReason(
        makeReservation({ can_cancel: false, cancellation_deadline: null }),
        now,
      ),
    ).toBe("This booking can't be cancelled anymore.")
  })
})

describe('cancellationStatus (card footer)', () => {
  const now = ms('2030-01-08T12:00:00-03:00')
  beforeEach(() => freezeDate('2030-01-08T12:00:00-03:00'))

  it('gives a short status with the free-cancellation deadline', () => {
    expect(cancellationStatus(makeReservation(), now)).toEqual({
      allowed: true,
      label: 'Free until today, 18:00',
      reason: null,
    })
    expect(
      cancellationStatus(
        makeReservation({ state: 'pending_payment', status: 'PENDING_PAYMENT' }),
        now,
      ),
    ).toEqual({ allowed: true, label: 'Free until it starts', reason: null })
  })

  it('says "Not available" with the reason when blocked', () => {
    expect(cancellationStatus(makeReservation({ can_cancel: false }), now)).toEqual({
      allowed: false,
      label: 'Not available',
      reason:
        "The club doesn't permit cancellations within 24 hours of the start of the booking.",
    })
    expect(
      cancellationStatus(
        makeReservation({
          role: 'guest',
          primary_player: 'carla@example.com',
          can_cancel: false,
        }),
        now,
      ),
    ).toMatchObject({ allowed: false, label: 'Not available' })
  })
})

describe('history', () => {
  it('says how a booking ended', () => {
    expect(historyStatus(makeReservation({ state: 'completed' }))).toEqual({
      tone: 'completed',
      label: 'Completed',
      detail: null,
    })
    expect(
      historyStatus(makeReservation({ state: 'expired', status: 'EXPIRED' })),
    ).toEqual({
      tone: 'expired',
      label: 'Expired',
      detail: "It wasn't paid in time, so the hold was released.",
    })
  })

  it('says when and why a booking was cancelled, and by whom for guests', () => {
    const cancelled = makeReservation({
      state: 'cancelled',
      status: 'CANCELLED',
      cancelled_at: '2030-01-07T21:15:00-03:00',
      cancellation_reason: ' Rain forecast ',
    })
    expect(historyStatus(cancelled)).toEqual({
      tone: 'cancelled',
      label: 'Cancelled',
      detail: 'On Mon, Jan 7, 21:15 · “Rain forecast”',
    })
    expect(
      historyStatus({ ...cancelled, role: 'guest', cancellation_reason: '' }),
    ).toEqual({
      tone: 'cancelled',
      label: 'Cancelled by the booking owner',
      detail: 'On Mon, Jan 7, 21:15',
    })
    expect(
      historyStatus({ ...cancelled, cancelled_at: null, cancellation_reason: '' }).detail,
    ).toBeNull()
  })

  it('shows instants in the viewer’s time (São Paulo in tests)', () => {
    expect(formatInstant('2030-01-08T01:30:00Z')).toBe('Mon, Jan 7, 22:30')
    expect(formatInstant('nonsense')).toBe('nonsense')
  })

  it('groups consecutive bookings by club-local month, keeping order', () => {
    const dec = makeReservation({ id: 'dec', start: '2029-12-30T10:00:00-03:00' })
    const jan1 = makeReservation({ id: 'jan1', start: '2030-01-20T10:00:00-03:00' })
    const jan2 = makeReservation({ id: 'jan2', start: '2030-01-02T10:00:00-03:00' })

    expect(
      groupByMonth([jan1, jan2, dec]).map((group) => [
        group.label,
        group.reservations.map((r) => r.id),
      ]),
    ).toEqual([
      ['January 2030', ['jan1', 'jan2']],
      ['December 2029', ['dec']],
    ])
  })
})
