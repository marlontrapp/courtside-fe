import { ApiError } from '@/api/client'
import { conflictingBookings, type AffectedBooking, type TemplateSlot } from '@/api/clubs'
import { isSessionError } from '@/pages/courts/format'

export const MINUTES_PER_DAY = 24 * 60

/** "HH:MM" → minutes after midnight; "24:00" = end of day. */
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Minutes after midnight → "HH:MM" (1440 → "24:00"). */
export function fromMinutes(total: number): string {
  const hours = String(Math.floor(total / 60)).padStart(2, '0')
  const minutes = String(total % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}

const quarters = (from: number, to: number) =>
  Array.from({ length: (to - from) / 15 + 1 }, (_, index) =>
    fromMinutes(from + index * 15),
  )

/** Slot starts every quarter hour: 00:00 … 23:45. */
export const QUARTER_STARTS = quarters(0, MINUTES_PER_DAY - 15)
/** Slot ends every quarter hour: 00:15 … 24:00 (midnight). */
export const QUARTER_ENDS = quarters(15, MINUTES_PER_DAY)

export const SLOT_LENGTHS = [30, 45, 60, 90, 120] as const

/**
 * Equal back-to-back slots from `open`, the last one ending by `close` — the
 * same rule as CourtControl's `grid_slots`.
 */
export function gridSlots(open: string, close: string, minutes: number): TemplateSlot[] {
  if (minutes <= 0) return []
  const slots: TemplateSlot[] = []
  const end = toMinutes(close)
  for (let cursor = toMinutes(open); cursor + minutes <= end; cursor += minutes) {
    slots.push({ start: fromMinutes(cursor), end: fromMinutes(cursor + minutes) })
  }
  return slots
}

export function sortSlots(slots: TemplateSlot[]): TemplateSlot[] {
  return [...slots].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
}

/** The slot "Add slot" appends: right after the last one, as long, within the day. */
export function nextSlot(slots: TemplateSlot[]): TemplateSlot | null {
  if (slots.length === 0) return { start: '08:00', end: '09:00' }
  const last = sortSlots(slots).at(-1)!
  const length = Math.max(toMinutes(last.end) - toMinutes(last.start), 15)
  const start = toMinutes(last.end)
  if (start >= MINUTES_PER_DAY) return null
  return {
    start: fromMinutes(start),
    end: fromMinutes(Math.min(start + length, MINUTES_PER_DAY)),
  }
}

/**
 * What CourtControl's `validate_day_slots` would reject, per slot index:
 * an end not after its start, and slots overlapping the previous one.
 */
export function validateSlots(slots: TemplateSlot[]): Record<number, string> {
  const errors: Record<number, string> = {}
  const order = slots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => toMinutes(a.slot.start) - toMinutes(b.slot.start))
  let previous: TemplateSlot | null = null
  for (const { slot, index } of order) {
    if (toMinutes(slot.end) <= toMinutes(slot.start)) {
      errors[index] = 'Must end after it starts.'
      continue
    }
    if (previous && toMinutes(slot.start) < toMinutes(previous.end)) {
      errors[index] = `Overlaps ${previous.start}–${previous.end}.`
    }
    previous = slot
  }
  return errors
}

/** "14 slots · 06:00–22:00 · 60 min each" — or "No slots (closed)". */
export function summarizeSlots(slots: TemplateSlot[]): string {
  if (slots.length === 0) return 'No slots — courts are closed on days using it'
  const sorted = sortSlots(slots)
  const lengths = new Set(
    sorted.map((slot) => toMinutes(slot.end) - toMinutes(slot.start)),
  )
  const parts = [
    `${sorted.length} ${sorted.length === 1 ? 'slot' : 'slots'}`,
    `${sorted[0].start}–${sorted.at(-1)!.end}`,
  ]
  if (lengths.size === 1) parts.push(`${[...lengths][0]} min each`)
  return parts.join(' · ')
}

export type TemplateErrors = {
  name?: string
  slots?: string
  general?: string
  /** Future bookings the change would cancel (409): offer to save anyway. */
  conflicts?: AffectedBooking[]
  sessionExpired?: boolean
  /** The list is stale (template gone / changed elsewhere): refresh it. */
  stale?: boolean
}

/** DRF wraps param names in backticks. */
const clean = (text: string) => text.replace(/`/g, '')

/** Map a failed create / update / delete onto the template form. */
export function templateErrors(error: unknown): TemplateErrors {
  if (isSessionError(error)) {
    return {
      general: 'Your session has expired. Sign in again to continue.',
      sessionExpired: true,
    }
  }
  if (!(error instanceof ApiError)) {
    return error instanceof TypeError
      ? { general: "Can't reach CourtControl. Check your connection and try again." }
      : { general: 'Something went wrong. Try again.' }
  }
  if (error.status === 409) {
    const conflicts = conflictingBookings(error)
    return conflicts.length
      ? {
          general: `${conflicts.length === 1 ? '1 future booking doesn’t' : `${conflicts.length} future bookings don’t`} fit the new slots.`,
          conflicts,
        }
      : { general: clean(error.message), stale: true }
  }
  if (error.status === 404) {
    return {
      general: 'This template no longer exists — it may have been deleted.',
      stale: true,
    }
  }
  if (error.status >= 500) {
    return {
      general: `CourtControl couldn't save the template right now (${error.status}). Try again in a moment.`,
    }
  }
  const errors: TemplateErrors = {}
  const general: string[] = []
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const text = messages.map(clean).join(' ')
    if (field === 'name') errors.name = text
    else if (field === 'slots') errors.slots = text
    else general.push(text)
  }
  if (general.length) errors.general = general.join(' ')
  if (!errors.name && !errors.slots && !errors.general)
    errors.general = clean(error.message)
  return errors
}
