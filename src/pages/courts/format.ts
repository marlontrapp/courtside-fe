import { ApiError } from '@/api/client'
import type { ClubSummary, Court, CourtTimeSlot } from '@/api/courts'

const SURFACE_LABELS: Record<string, string> = {
  CLAY: 'Clay',
  HARD: 'Hard',
  GRASS: 'Grass',
  SYNTHETIC: 'Synthetic',
}

const NOTICE_LABELS: Record<string, string> = {
  MAINTENANCE: 'Maintenance',
  WEATHER: 'Weather',
  TOURNAMENT: 'Tournament',
  EVENT: 'Event',
  HOLIDAY: 'Holiday',
  OTHER: 'Notice',
}

/** `SOME_VALUE` → `Some value` for enum values the FE doesn't know yet. */
function humanize(value: string): string {
  const words = value.replace(/_/g, ' ').trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : value
}

export function surfaceLabel(surface: string): string {
  return SURFACE_LABELS[surface] ?? humanize(surface)
}

export function noticeLabel(type: string): string {
  return NOTICE_LABELS[type] ?? humanize(type)
}

/** DOM id of a court's card — the booking flow returns focus here. */
export function courtCardId(courtId: string): string {
  return `court-${courtId}`
}

export function isMembersOnly(club: ClubSummary): boolean {
  return club.access_type === 'MEMBERS_ONLY'
}

/** "Clay · Outdoor · Lighting" */
export function courtFeatures(court: Court): string {
  return [
    surfaceLabel(court.surface_type),
    court.is_indoor ? 'Indoor' : 'Outdoor',
    court.has_lighting ? 'Lighting' : 'No lighting',
  ].join(' · ')
}

function parseAmount(value: string): number | null {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

const amountFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "1,250.50" — the API sends no currency, so none is shown. */
export function formatAmount(amount: number): string {
  return amountFormat.format(amount)
}

/**
 * "120.00 / hour · +30.00 lighting". The API sends no currency, so none is shown.
 * Returns null when the club hasn't set a rate (0.00) or it can't be parsed.
 */
export function courtPricing(court: Court): string | null {
  const rate = parseAmount(court.hourly_rate)
  if (rate === null || rate <= 0) return null

  const parts = [`${amountFormat.format(rate)} / hour`]
  const fee = parseAmount(court.lighting_fee)
  if (court.has_lighting && fee !== null && fee > 0) {
    parts.push(`+${amountFormat.format(fee)} lighting`)
  }
  return parts.join(' · ')
}

/**
 * Wall-clock "HH:MM" of an ISO timestamp. Slots come in the club's own timezone
 * (offset included), so the written time is already the club-local time.
 */
export function clockTime(iso: string): string {
  const match = /T(\d{2}:\d{2})/.exec(iso)
  return match ? match[1] : iso
}

/** "17:00–18:00" */
export function slotLabel(slot: CourtTimeSlot): string {
  return `${clockTime(slot.start)}–${clockTime(slot.end)}`
}

/** Club-local calendar day `YYYY-MM-DD` of an ISO timestamp. */
export function slotDay(iso: string): string {
  return iso.slice(0, 10)
}

const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

/** `2030-01-08` → "Tue, Jan 8" */
export function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? isoDate : dayFormat.format(date)
}

/** Today's date `YYYY-MM-DD` in `timeZone` (the viewer's zone when omitted or unknown). */
export function todayIn(timeZone?: string, now: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now)
  } catch {
    return new Intl.DateTimeFormat('en-CA').format(now)
  }
}

const dayWithYearFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function shiftDay(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-CA').format(new Date(year, month - 1, day + days))
}

/**
 * "Today" / "Tomorrow" / "Yesterday" / "Sat, Nov 14", relative to `today`
 * (`YYYY-MM-DD`); other years get the year: "Mon, Nov 9, 2025".
 */
export function dayLabel(isoDate: string, today: string): string {
  if (isoDate === today) return 'Today'
  if (isoDate === shiftDay(today, 1)) return 'Tomorrow'
  if (isoDate === shiftDay(today, -1)) return 'Yesterday'
  if (isoDate.slice(0, 4) !== today.slice(0, 4)) {
    const [year, month, day] = isoDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return Number.isNaN(date.getTime()) ? isoDate : dayWithYearFormat.format(date)
  }
  return formatDay(isoDate)
}

/** "Today" / "Tomorrow" / "Yesterday" read better mid-sentence in lower case. */
export function inSentence(day: string): string {
  return day === 'Today' || day === 'Tomorrow' || day === 'Yesterday'
    ? day.toLowerCase()
    : day
}

export type SlotDay = {
  date: string
  slots: CourtTimeSlot[]
}

/** Slots grouped by club-local day, in API order. */
export function groupSlotsByDay(slots: CourtTimeSlot[]): SlotDay[] {
  const days = new Map<string, CourtTimeSlot[]>()
  for (const slot of slots) {
    const day = slotDay(slot.start)
    const bucket = days.get(day)
    if (bucket) bucket.push(slot)
    else days.set(day, [slot])
  }
  return [...days].map(([date, daySlots]) => ({ date, slots: daySlots }))
}

export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * "Slots in Lisbon time" when the club's timezone differs from the viewer's — the slot
 * times shown are club-local, which would otherwise be misleading.
 */
export function clubTimeZoneHint(
  club: Pick<ClubSummary, 'timezone'>,
  viewerZone: string = viewerTimeZone(),
): string | null {
  if (!club.timezone || club.timezone === viewerZone) return null
  const city = club.timezone.split('/').pop()?.replace(/_/g, ' ')
  return `Slots in ${city || club.timezone} time`
}

export type ClubGroup = {
  club: ClubSummary
  courts: Court[]
}

/** Group courts by club, keeping the API's order (club name, then court name). */
export function groupCourtsByClub(courts: Court[]): ClubGroup[] {
  const groups = new Map<string, ClubGroup>()
  for (const court of courts) {
    const group = groups.get(court.club.id)
    if (group) {
      group.courts.push(court)
    } else {
      groups.set(court.club.id, { club: court.club, courts: [court] })
    }
  }
  return [...groups.values()]
}

/** Drop courts repeated across pages (the list can shift between page requests). */
export function uniqueCourts(courts: Court[]): Court[] {
  const seen = new Set<string>()
  return courts.filter((court) => {
    if (seen.has(court.id)) return false
    seen.add(court.id)
    return true
  })
}

export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export function isSessionError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

/** User-facing copy for a failed list request, e.g. `subject` = "courts". */
export function describeLoadError(error: unknown, subject: string): string {
  if (isSessionError(error)) {
    return `Your session has expired. Sign in again to see ${subject}.`
  }
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      return `CourtControl couldn't load ${subject} right now (${error.status}). Try again in a moment.`
    }
    return error.message
  }
  if (error instanceof TypeError) {
    // fetch() rejects with a TypeError when the network request itself fails.
    return "Can't reach CourtControl. Check your connection and that the API is running."
  }
  return `Something went wrong while loading ${subject}. Try again.`
}

/** User-facing copy for a failed courts request. */
export function describeCourtsError(error: unknown): string {
  return describeLoadError(error, 'courts')
}
