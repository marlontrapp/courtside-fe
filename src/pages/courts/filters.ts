import { ApiError } from '@/api/client'
import { parseISODate, toISODate } from '@/components/calendarUtils'
import { formatDay } from '@/pages/courts/format'

/** Court surfaces CourtControl knows (`Court.SurfaceType`). */
export const SURFACES = ['CLAY', 'HARD', 'GRASS', 'SYNTHETIC'] as const
export type Surface = (typeof SURFACES)[number]

export type Setting = 'all' | 'indoor' | 'outdoor'

/** CourtControl caps availability windows at 7 days (`MAX_WINDOW_DAYS`). */
export const MAX_WINDOW_DAYS = 7

/**
 * Filters as the UI thinks about them. Empty string / empty list = not set.
 *
 * `dateFrom` alone means one day; `dateFrom` + `dateTo` a range. No date means
 * today (the API default).
 */
export type CourtFilters = {
  surfaces: Surface[]
  setting: Setting
  clubs: string[]
  dateFrom: string
  dateTo: string
  timeFrom: string
  timeTo: string
}

export const EMPTY_FILTERS: CourtFilters = {
  surfaces: [],
  setting: 'all',
  clubs: [],
  dateFrom: '',
  dateTo: '',
  timeFrom: '',
  timeTo: '',
}

export type FilterField = keyof CourtFilters

/** Per-field messages, plus `general` for errors that don't belong to one field. */
export type FilterErrors = Partial<Record<FilterField | 'general', string>>

// --- URL <-> filters ----------------------------------------------------------------

/** Query-string keys the page uses (kept readable; mapped to API params separately). */
const URL_KEYS = {
  surfaces: 'surface',
  setting: 'setting',
  clubs: 'club',
  dateFrom: 'from',
  dateTo: 'to',
  timeFrom: 'time_from',
  timeTo: 'time_to',
} as const satisfies Record<FilterField, string>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const START_TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const END_TIME = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRealDate(value: string): boolean {
  return ISO_DATE.test(value) && toISODate(parseISODate(value)) === value
}

function splitList(value: string | null): string[] {
  if (!value) return []
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]
}

/**
 * Read filters from the URL, dropping values the API would reject outright
 * (unknown surfaces, malformed ids/dates/times) so a hand-edited or stale link
 * still shows a sensible list.
 */
export function parseFilters(params: URLSearchParams): CourtFilters {
  const surfaces = splitList(params.get(URL_KEYS.surfaces))
    .map((value) => value.toUpperCase())
    .filter((value): value is Surface => (SURFACES as readonly string[]).includes(value))

  const setting = params.get(URL_KEYS.setting)
  const dateFrom = params.get(URL_KEYS.dateFrom) ?? ''
  const dateTo = params.get(URL_KEYS.dateTo) ?? ''
  const timeFrom = params.get(URL_KEYS.timeFrom) ?? ''
  const timeTo = params.get(URL_KEYS.timeTo) ?? ''

  return {
    surfaces,
    setting: setting === 'indoor' || setting === 'outdoor' ? setting : 'all',
    clubs: splitList(params.get(URL_KEYS.clubs)).filter((id) => UUID.test(id)),
    dateFrom: isRealDate(dateFrom) ? dateFrom : '',
    dateTo: isRealDate(dateTo) ? dateTo : '',
    timeFrom: START_TIME.test(timeFrom) ? timeFrom : '',
    timeTo: END_TIME.test(timeTo) ? timeTo : '',
  }
}

export function filtersToSearchParams(filters: CourtFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.surfaces.length) params.set(URL_KEYS.surfaces, filters.surfaces.join(','))
  if (filters.setting !== 'all') params.set(URL_KEYS.setting, filters.setting)
  if (filters.clubs.length) params.set(URL_KEYS.clubs, filters.clubs.join(','))
  if (filters.dateFrom) params.set(URL_KEYS.dateFrom, filters.dateFrom)
  if (filters.dateTo) params.set(URL_KEYS.dateTo, filters.dateTo)
  if (filters.timeFrom) params.set(URL_KEYS.timeFrom, filters.timeFrom)
  if (filters.timeTo) params.set(URL_KEYS.timeTo, filters.timeTo)
  return params
}

// --- filters -> API -------------------------------------------------------------------

/** Query params for `GET /api/v1/courts/` (see CourtFilter + AvailabilityQuerySerializer). */
export type CourtQueryParams = Partial<
  Record<
    | 'surface_type'
    | 'is_indoor'
    | 'club'
    | 'date'
    | 'date_from'
    | 'date_to'
    | 'time_from'
    | 'time_to',
    string
  >
>

export function toApiParams(filters: CourtFilters): CourtQueryParams {
  const params: CourtQueryParams = {}
  if (filters.surfaces.length) params.surface_type = filters.surfaces.join(',')
  if (filters.setting !== 'all') params.is_indoor = String(filters.setting === 'indoor')
  if (filters.clubs.length) params.club = filters.clubs.join(',')

  if (filters.dateFrom && filters.dateTo && filters.dateTo !== filters.dateFrom) {
    params.date_from = filters.dateFrom
    params.date_to = filters.dateTo
  } else if (filters.dateFrom) {
    params.date = filters.dateFrom
  }

  if (filters.timeFrom) params.time_from = filters.timeFrom
  if (filters.timeTo) params.time_to = filters.timeTo
  return params
}

export function activeFilterCount(filters: CourtFilters): number {
  return [
    filters.surfaces.length > 0,
    filters.setting !== 'all',
    filters.clubs.length > 0,
    Boolean(filters.dateFrom || filters.dateTo),
    Boolean(filters.timeFrom || filters.timeTo),
  ].filter(Boolean).length
}

/** True when a date/time window is set: the API then hides courts with no free slot in it. */
export function hasWindow(filters: CourtFilters): boolean {
  return Boolean(filters.dateFrom || filters.dateTo || filters.timeFrom || filters.timeTo)
}

// --- validation -----------------------------------------------------------------------

export function addDays(isoDate: string, days: number): string {
  const date = parseISODate(isoDate)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

/** Last day a range starting on `dateFrom` may end on. */
export function maxRangeEnd(dateFrom: string): string {
  return addDays(dateFrom, MAX_WINDOW_DAYS - 1)
}

/**
 * Catch what the API would reject before asking it. `today` is the viewer's
 * date; the API still has the last word (its "today" is the club-server zone).
 */
export function validateFilters(filters: CourtFilters, today: string): FilterErrors {
  const errors: FilterErrors = {}
  const { dateFrom, dateTo, timeFrom, timeTo } = filters

  if (dateTo && !dateFrom) {
    errors.dateFrom = 'Pick a start date for the range.'
  } else if (dateFrom && dateFrom < today) {
    errors.dateFrom = 'Pick today or a later date.'
  }

  if (dateFrom && dateTo) {
    if (dateTo < dateFrom) {
      errors.dateTo = 'Must be on or after the start date.'
    } else if (dateTo > maxRangeEnd(dateFrom)) {
      errors.dateTo = `Ranges can span up to ${MAX_WINDOW_DAYS} days (until ${formatDay(maxRangeEnd(dateFrom))}).`
    }
  }

  if (timeFrom && timeTo && timeTo <= timeFrom) {
    errors.timeTo = 'Must be after the earliest start.'
  }

  return errors
}

export function hasErrors(errors: FilterErrors): boolean {
  return Object.values(errors).some(Boolean)
}

/** API param → the filter control that owns it. */
const API_FIELD_TO_FILTER: Record<string, FilterField> = {
  surface_type: 'surfaces',
  is_indoor: 'setting',
  club: 'clubs',
  date: 'dateFrom',
  date_from: 'dateFrom',
  date_to: 'dateTo',
  time_from: 'timeFrom',
  time_to: 'timeTo',
}

/** DRF wraps param names in backticks ("`date_from` and `date_to` …"). */
function cleanMessage(message: string): string {
  return message.replace(/`/g, '')
}

/** Map a 400 from the courts API onto the filter fields it's about. */
export function serverFilterErrors(error: unknown): FilterErrors {
  if (!(error instanceof ApiError) || error.status !== 400) return {}

  const errors: FilterErrors = {}
  const general: string[] = []
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const text = messages.map(cleanMessage).join(' ')
    const target = API_FIELD_TO_FILTER[field]
    if (target && !errors[target]) errors[target] = text
    else general.push(text)
  }
  if (general.length) errors.general = general.join(' ')
  if (!hasErrors(errors)) errors.general = cleanMessage(error.message)
  return errors
}

// --- time options -------------------------------------------------------------------------

function halfHours(): string[] {
  return Array.from({ length: 48 }, (_, index) => {
    const hours = String(Math.floor(index / 2)).padStart(2, '0')
    return `${hours}:${index % 2 ? '30' : '00'}`
  })
}

/** Earliest-start choices: 00:00 … 23:30. */
export const START_TIMES = halfHours()
/** Latest-end choices: 00:30 … 24:00 (midnight, end of day). */
export const END_TIMES = [...halfHours().slice(1), '24:00']

// --- copy -----------------------------------------------------------------------------------

function describeTimes({ timeFrom, timeTo }: CourtFilters): string | null {
  if (timeFrom && timeTo) return `between ${timeFrom} and ${timeTo}`
  if (timeFrom) return `starting from ${timeFrom}`
  if (timeTo) return `ending by ${timeTo}`
  return null
}

function describeDates({ dateFrom, dateTo }: CourtFilters, today: string): string {
  if (dateFrom && dateTo && dateTo !== dateFrom) {
    return `from ${formatDay(dateFrom)} to ${formatDay(dateTo)}`
  }
  if (!dateFrom || dateFrom === today) return 'today'
  return `on ${formatDay(dateFrom)}`
}

/** "Courts with a free slot on Sat, Nov 14 between 18:00 and 21:00." — null without a window. */
export function describeWindow(filters: CourtFilters, today: string): string | null {
  if (!hasWindow(filters)) return null
  const parts = [describeDates(filters, today), describeTimes(filters)].filter(Boolean)
  return `Courts with a free slot ${parts.join(' ')}.`
}
