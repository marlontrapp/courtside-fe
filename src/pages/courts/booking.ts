import { ApiError } from '@/api/client'
import type { Court, CourtTimeSlot } from '@/api/courts'
import type { BookingType, ReservationRequest } from '@/api/reservations'
import { clockTime, isSessionError, slotDay } from '@/pages/courts/format'

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  SINGLES: 'Singles',
  DOUBLES: 'Doubles',
  LESSON: 'Lesson',
}

/** One way to end a booking that starts at the clicked slot. */
export type EndOption = {
  /** ISO end of the last covered slot (club-local offset). */
  end: string
  /** How many consecutive slots it covers. */
  slots: number
  minutes: number
}

const instant = (iso: string) => Date.parse(iso)

function minutesBetween(start: string, end: string): number {
  return Math.round((instant(end) - instant(start)) / 60_000)
}

/**
 * CourtControl books one or more *consecutive* slots of a day. From the
 * clicked slot, follow the court's free slots while each starts exactly when
 * the previous one ends (same club-local day) — every step is a valid end.
 */
export function endOptions(court: Court, start: CourtTimeSlot): EndOption[] {
  const slots = [...court.available_slots].sort(
    (a, b) => instant(a.start) - instant(b.start),
  )
  const index = slots.findIndex((slot) => slot.start === start.start)
  if (index === -1)
    return [{ end: start.end, slots: 1, minutes: minutesBetween(start.start, start.end) }]

  const options: EndOption[] = []
  const day = slotDay(start.start)
  let previous = slots[index]
  options.push({
    end: previous.end,
    slots: 1,
    minutes: minutesBetween(start.start, previous.end),
  })
  for (const slot of slots.slice(index + 1)) {
    if (slotDay(slot.start) !== day || instant(slot.start) !== instant(previous.end))
      break
    options.push({
      end: slot.end,
      slots: options.length + 1,
      minutes: minutesBetween(start.start, slot.end),
    })
    previous = slot
  }
  return options
}

/** "60 min", "90 min", "2 h", "2 h 30 min" — slot-sized durations read best in minutes. */
export function formatDuration(minutes: number): string {
  if (minutes <= 90) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/**
 * Wall-clock end time for the API. A slot ending at midnight comes back as the
 * next day's `T00:00`; the booking endpoint wants "24:00" on the start date.
 */
export function endTimeFor(startIso: string, endIso: string): string {
  const time = clockTime(endIso)
  return time === '00:00' && slotDay(endIso) !== slotDay(startIso) ? '24:00' : time
}

export type BookingFormValues = {
  end: string
  bookingType: BookingType
  includesLighting: boolean
  guests: { email: string }[]
  notes: string
}

export function buildReservationRequest(
  court: Court,
  start: CourtTimeSlot,
  values: BookingFormValues,
): ReservationRequest {
  return {
    court: court.id,
    date: slotDay(start.start),
    start_time: clockTime(start.start),
    end_time: endTimeFor(start.start, values.end),
    booking_type: values.bookingType,
    // Never ask for lighting on a court without it (the API rejects that).
    includes_lighting: court.has_lighting && values.includesLighting,
    guests: values.guests.map((guest) => guest.email.trim()).filter(Boolean),
    notes: values.notes.trim(),
  }
}

/**
 * Same arithmetic as CourtControl's `calculate_total_price`: rate × hours, plus
 * the lighting fee × hours when lighting is included. Null if the court has no rate.
 */
export function estimateTotal(
  court: Court,
  minutes: number,
  includesLighting: boolean,
): number | null {
  const rate = Number(court.hourly_rate)
  if (!Number.isFinite(rate) || rate <= 0) return null
  const hours = minutes / 60
  const fee = Number(court.lighting_fee)
  const lighting =
    includesLighting && court.has_lighting && Number.isFinite(fee) ? fee : 0
  return Math.round((rate + lighting) * hours * 100) / 100
}

export type BookingErrors = {
  /** Shown above the form actions. */
  general?: string
  guests?: string
  notes?: string
  /** The slot was taken (409): the list needs a refresh and the user another slot. */
  conflict?: boolean
  sessionExpired?: boolean
}

/** DRF wraps param names in backticks ("Must be after `start_time`."). */
const clean = (message: string) => message.replace(/`/g, '')

/** Map a failed booking onto the form. */
export function bookingErrors(error: unknown): BookingErrors {
  if (isSessionError(error)) {
    return {
      general: 'Your session has expired. Sign in again to book.',
      sessionExpired: true,
    }
  }
  if (!(error instanceof ApiError)) {
    return error instanceof TypeError
      ? { general: "Can't reach CourtControl. Check your connection and try again." }
      : { general: 'Something went wrong while booking. Try again.' }
  }
  if (error.status === 409) {
    return {
      general: 'That slot was just taken. Pick another time.',
      conflict: true,
    }
  }
  if (error.status >= 500) {
    return {
      general: `CourtControl couldn't book the court right now (${error.status}). Try again in a moment.`,
    }
  }

  const errors: BookingErrors = {}
  const general: string[] = []
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const text = messages.map(clean).join(' ')
    if (field === 'guests') errors.guests = text
    else if (field === 'notes') errors.notes = text
    else if (field === 'court') {
      // Courts the user can't book are reported like unknown ids.
      general.push('This court is no longer available to you.')
    } else general.push(text)
  }
  if (general.length) errors.general = general.join(' ')
  if (!errors.general && !errors.guests && !errors.notes)
    errors.general = clean(error.message)
  return errors
}
