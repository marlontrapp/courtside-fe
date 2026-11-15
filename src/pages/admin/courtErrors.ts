import { ApiError } from '@/api/client'
import { conflictingBookings, type AffectedBooking } from '@/api/clubs'
import { isSessionError } from '@/pages/courts/format'

export type CourtErrors = {
  name?: string
  surface_type?: string
  hourly_rate?: string
  lighting_fee?: string
  general?: string
  /** Future bookings deactivating would cancel (409): offer force. */
  conflicts?: AffectedBooking[]
  /** Delete blocked because the court has booking history — deactivate instead. */
  hasBookings?: boolean
  /** Delete blocked because rules link to this court — offer force unlink. */
  linkedRules?: boolean
  sessionExpired?: boolean
  stale?: boolean
}

const clean = (text: string) => text.replace(/`/g, '')

/** Map a failed create / update / delete onto the court form. */
export function courtErrors(error: unknown): CourtErrors {
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
        general: `${conflicts.length === 1 ? '1 future booking' : `${conflicts.length} future bookings`} on this court — deactivating it would leave ${conflicts.length === 1 ? 'it' : 'them'} without a court.`,
        conflicts,
      }
    }
    const detail = clean(error.message)
    if (/deactivate/i.test(detail)) {
      return {
        general: detail,
        hasBookings: true,
      }
    }
    if (/rule|unlink|link/i.test(detail)) {
      return {
        general: detail,
        linkedRules: true,
      }
    }
    return { general: detail, stale: true }
  }
  if (error.status === 404) {
    return {
      general: 'This court no longer exists — it may have been deleted.',
      stale: true,
    }
  }
  if (error.status >= 500) {
    return {
      general: `CourtControl couldn't save the court right now (${error.status}). Try again in a moment.`,
    }
  }
  const errors: CourtErrors = {}
  const general: string[] = []
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const text = messages.map(clean).join(' ')
    if (field === 'name') errors.name = text
    else if (field === 'surface_type') errors.surface_type = text
    else if (field === 'hourly_rate') errors.hourly_rate = text
    else if (field === 'lighting_fee') errors.lighting_fee = text
    else general.push(text)
  }
  if (general.length) errors.general = general.join(' ')
  if (!errors.name && !errors.surface_type && !errors.hourly_rate && !errors.lighting_fee && !errors.general) {
    errors.general = clean(error.message)
  }
  return errors
}

/** Non-negative money as CourtControl expects: digits with optional `.` and up to 2 decimals. */
export function normalizeMoney(raw: string): string | null {
  const trimmed = raw.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const [whole, fraction = ''] = trimmed.split('.')
  return `${whole}.${fraction.padEnd(2, '0')}`
}
