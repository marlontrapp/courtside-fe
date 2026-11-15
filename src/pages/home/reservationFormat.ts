import type { Reservation } from '@/api/reservations'
import { BOOKING_TYPE_LABELS, endTimeFor, formatDuration } from '@/pages/courts/booking'
import { clockTime, dayLabel, inSentence, slotDay, todayIn } from '@/pages/courts/format'

/** A booking starting within this many minutes is flagged as starting soon. */
export const STARTING_SOON_MINUTES = 60

export type Timing = { kind: 'in-progress' } | { kind: 'soon'; minutes: number } | null

/** Whether the booking is being played right now, or starts within the hour. */
export function reservationTiming(reservation: Reservation, now: number): Timing {
  const start = Date.parse(reservation.start)
  const end = Date.parse(reservation.end)
  if (start <= now && now < end) return { kind: 'in-progress' }
  const minutes = Math.ceil((start - now) / 60_000)
  if (minutes > 0 && minutes <= STARTING_SOON_MINUTES) return { kind: 'soon', minutes }
  return null
}

export function hasEnded(reservation: Reservation, now: number): boolean {
  return Date.parse(reservation.end) <= now
}

/** "Today" / "Tomorrow" / "Sat, Nov 14" — in the club's timezone, like the times. */
export function reservationDay(reservation: Reservation): string {
  return dayLabel(slotDay(reservation.start), todayIn(reservation.court.club.timezone))
}

/** "18:00–20:00"; a booking ending at midnight reads "23:00–24:00". */
export function reservationTimeRange(reservation: Reservation): string {
  return `${clockTime(reservation.start)}–${endTimeFor(reservation.start, reservation.end)}`
}

export function reservationDuration(reservation: Reservation): string {
  const minutes = Math.round(
    (Date.parse(reservation.end) - Date.parse(reservation.start)) / 60_000,
  )
  return formatDuration(minutes)
}

/** Player types have labels; staff-only ones (a tournament you're in) fall back to a readable form. */
export function bookingTypeLabel(type: string): string {
  const known = BOOKING_TYPE_LABELS[type as keyof typeof BOOKING_TYPE_LABELS]
  if (known) return known
  const words = type.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function isGuest(reservation: Reservation): boolean {
  return reservation.role === 'guest'
}

export function isAwaitingPayment(reservation: Reservation): boolean {
  return reservation.state === 'pending_payment'
}

/** Who else plays: the booker for a guest, the guests for the booker. */
export function reservationPeople(reservation: Reservation): string | null {
  if (isGuest(reservation)) return `Booked by ${reservation.primary_player}`
  return reservation.guests.length ? `With ${reservation.guests.join(', ')}` : null
}

/**
 * When the booking can still be cancelled — only for bookings this user may
 * cancel now (`can_cancel`); see `cancelBlockedReason` for the others.
 */
export function cancellationNote(reservation: Reservation): string | null {
  if (!reservation.can_cancel) return null
  if (isAwaitingPayment(reservation)) return 'Can be cancelled until it starts.'
  const deadline = reservation.cancellation_deadline
  if (!deadline) return null
  const day = dayLabel(slotDay(deadline), todayIn(reservation.court.club.timezone))
  return `Free cancellation until ${inSentence(day)}, ${clockTime(deadline)}.`
}

/**
 * The club's cancellation window in whole hours. CourtControl doesn't send it,
 * but every reservation carries its deadline = start − window.
 */
export function cancellationWindowHours(reservation: Reservation): number | null {
  const deadline = reservation.cancellation_deadline
  if (!deadline) return null
  const hours = Math.round(
    (Date.parse(reservation.start) - Date.parse(deadline)) / 3_600_000,
  )
  return Number.isFinite(hours) && hours >= 0 ? hours : null
}

export type CancellationStatus = {
  /** Whether the Cancel button is enabled. */
  allowed: boolean
  /** Short status for the card footer: "Free until tomorrow, 10:00" / "Not available". */
  label: string
  /** Why it isn't available — null when allowed. */
  reason: string | null
}

/** The card footer's cancellation field: a short status plus, when blocked, why. */
export function cancellationStatus(
  reservation: Reservation,
  now: number,
): CancellationStatus {
  const reason = cancelBlockedReason(reservation, now)
  if (reason) return { allowed: false, label: 'Not available', reason }
  if (isAwaitingPayment(reservation)) {
    return { allowed: true, label: 'Free until it starts', reason: null }
  }
  const deadline = reservation.cancellation_deadline
  if (!deadline) return { allowed: true, label: 'Available', reason: null }
  const day = dayLabel(slotDay(deadline), todayIn(reservation.court.club.timezone))
  return {
    allowed: true,
    label: `Free until ${inSentence(day)}, ${clockTime(deadline)}`,
    reason: null,
  }
}

/** Why the Cancel button is disabled — null when the booking can be cancelled. */
export function cancelBlockedReason(
  reservation: Reservation,
  now: number,
): string | null {
  if (reservation.can_cancel) return null
  // Only the booker can cancel (CourtControl answers 403 to guests).
  if (isGuest(reservation)) {
    return "Guests can't cancel a booking. Ask the booking owner to cancel it."
  }
  if (Date.parse(reservation.start) <= now) {
    return "This booking has already started, so it can't be cancelled."
  }
  const hours = cancellationWindowHours(reservation)
  if (!isAwaitingPayment(reservation) && hours) {
    return `The club doesn't permit cancellations within ${hours === 1 ? '1 hour' : `${hours} hours`} of the start of the booking.`
  }
  return "This booking can't be cancelled anymore."
}

// --- History ---------------------------------------------------------------------------

export type HistoryTone = 'completed' | 'cancelled' | 'expired' | 'other'

export type HistoryStatus = {
  tone: HistoryTone
  /** Short status for the card footer: "Completed" / "Cancelled" / "Expired". */
  label: string
  /** Secondary line: when it was cancelled and why, or why it expired. */
  detail: string | null
}

const instantFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** An instant in the viewer's own time: "Thu, Nov 12, 22:16". */
export function formatInstant(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : instantFormat.format(date)
}

/** How a finished / inactive booking ended, for the history card footer. */
export function historyStatus(reservation: Reservation): HistoryStatus {
  switch (reservation.state) {
    case 'completed':
      return { tone: 'completed', label: 'Completed', detail: null }
    case 'cancelled': {
      // Only the booker can cancel: as a guest, it was the owner.
      const label = isGuest(reservation) ? 'Cancelled by the booking owner' : 'Cancelled'
      const when = reservation.cancelled_at
        ? `On ${formatInstant(reservation.cancelled_at)}`
        : null
      const reason = reservation.cancellation_reason?.trim()
      const detail = [when, reason ? `“${reason}”` : null].filter(Boolean).join(' · ')
      return { tone: 'cancelled', label, detail: detail || null }
    }
    case 'expired':
      return {
        tone: 'expired',
        label: 'Expired',
        detail: "It wasn't paid in time, so the hold was released.",
      }
    default: {
      const words = reservation.state.replace(/_/g, ' ')
      return {
        tone: 'other',
        label: words.charAt(0).toUpperCase() + words.slice(1),
        detail: null,
      }
    }
  }
}

export type MonthGroup = {
  /** `YYYY-MM` of the club-local start date. */
  key: string
  /** "November 2026" */
  label: string
  reservations: Reservation[]
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

/** Consecutive bookings grouped by (club-local) month, keeping the list's order. */
export function groupByMonth(reservations: Reservation[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  for (const reservation of reservations) {
    const key = slotDay(reservation.start).slice(0, 7)
    const last = groups.at(-1)
    if (last && last.key === key) {
      last.reservations.push(reservation)
    } else {
      const [year, month] = key.split('-').map(Number)
      groups.push({
        key,
        label: monthFormat.format(new Date(year, month - 1, 1)),
        reservations: [reservation],
      })
    }
  }
  return groups
}
