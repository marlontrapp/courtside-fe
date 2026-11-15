import { ApiError } from '@/api/client'
import { conflictingBookings, type AffectedBooking } from '@/api/clubs'
import { isSessionError } from '@/pages/courts/format'

export type OverrideErrors = {
  date?: string
  type?: string
  notes?: string
  day_template?: string
  courts?: string
  general?: string
  conflicts?: AffectedBooking[]
  sessionExpired?: boolean
  stale?: boolean
}

const clean = (text: string) => text.replace(/`/g, '')

/** Map a failed override create / update / delete onto the form. */
export function overrideErrors(error: unknown): OverrideErrors {
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
    if (conflicts.length) {
      return {
        general: `${conflicts.length === 1 ? '1 future booking' : `${conflicts.length} future bookings`} wouldn’t fit this override.`,
        conflicts,
      }
    }
    return { general: clean(error.message), stale: true }
  }
  if (error.status === 404) {
    return {
      general: 'This override no longer exists — it may have been removed.',
      stale: true,
    }
  }
  if (error.status >= 500) {
    return {
      general: `CourtControl couldn't save the override right now (${error.status}). Try again in a moment.`,
    }
  }
  const errors: OverrideErrors = {}
  const general: string[] = []
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const text = messages.map(clean).join(' ')
    if (field === 'date' || field === 'day') errors.date = text
    else if (field === 'type') errors.type = text
    else if (field === 'notes') errors.notes = text
    else if (field === 'day_template') errors.day_template = text
    else general.push(text)
  }
  if (general.length) errors.general = general.join(' ')
  if (!errors.date && !errors.type && !errors.notes && !errors.day_template && !errors.general) {
    errors.general = clean(error.message)
  }
  return errors
}
