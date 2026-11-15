import { ApiError } from '@/api/client'
import {
  PLAYER_BOOKING_TYPES,
  type BookingType,
  type ReservationListParams,
} from '@/api/reservations'
import { parseISODate, toISODate } from '@/components/calendarUtils'

/** Finished or inactive bookings — the history (upcoming ones live on Home). */
export const HISTORY_STATES = ['completed', 'cancelled', 'expired'] as const
export type HistoryState = (typeof HISTORY_STATES)[number]

export type HistoryRole = 'all' | 'owner' | 'guest'

/** Filters as the page models them; empty = not set. Dates are club-local, inclusive. */
export type HistoryFilters = {
  states: HistoryState[]
  role: HistoryRole
  types: BookingType[]
  dateFrom: string
  dateTo: string
}

export const EMPTY_HISTORY_FILTERS: HistoryFilters = {
  states: [],
  role: 'all',
  types: [],
  dateFrom: '',
  dateTo: '',
}

export type HistoryField = keyof HistoryFilters
export type HistoryFilterErrors = Partial<Record<HistoryField | 'general', string>>

const URL_KEYS = {
  states: 'status',
  role: 'role',
  types: 'type',
  dateFrom: 'from',
  dateTo: 'to',
} as const satisfies Record<HistoryField, string>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(value: string): boolean {
  return ISO_DATE.test(value) && toISODate(parseISODate(value)) === value
}

function splitList<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  if (!value) return []
  const items = value.split(',').map((item) => item.trim())
  return allowed.filter((option) =>
    items.some((item) => item.toLowerCase() === option.toLowerCase()),
  )
}

/** Read filters from the URL, dropping values CourtControl would reject. */
export function parseHistoryFilters(params: URLSearchParams): HistoryFilters {
  const role = params.get(URL_KEYS.role)
  const dateFrom = params.get(URL_KEYS.dateFrom) ?? ''
  const dateTo = params.get(URL_KEYS.dateTo) ?? ''
  return {
    states: splitList(params.get(URL_KEYS.states), HISTORY_STATES),
    role: role === 'owner' || role === 'guest' ? role : 'all',
    types: splitList(params.get(URL_KEYS.types), PLAYER_BOOKING_TYPES),
    dateFrom: isRealDate(dateFrom) ? dateFrom : '',
    dateTo: isRealDate(dateTo) ? dateTo : '',
  }
}

export function historyFiltersToSearchParams(filters: HistoryFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.states.length) params.set(URL_KEYS.states, filters.states.join(','))
  if (filters.role !== 'all') params.set(URL_KEYS.role, filters.role)
  if (filters.types.length) params.set(URL_KEYS.types, filters.types.join(','))
  if (filters.dateFrom) params.set(URL_KEYS.dateFrom, filters.dateFrom)
  if (filters.dateTo) params.set(URL_KEYS.dateTo, filters.dateTo)
  return params
}

/** `GET /api/v1/reservations/` params: no status filter = the whole history, newest first. */
export function historyApiParams(filters: HistoryFilters): ReservationListParams {
  const params: ReservationListParams = {
    state: (filters.states.length ? filters.states : HISTORY_STATES).join(','),
    ordering: '-start',
  }
  if (filters.role !== 'all') params.role = filters.role
  if (filters.types.length) params.booking_type = filters.types.join(',')
  // Open-ended and inclusive on either side (ReservationFilter).
  if (filters.dateFrom) params.date_from = filters.dateFrom
  if (filters.dateTo) params.date_to = filters.dateTo
  return params
}

export function activeHistoryFilterCount(filters: HistoryFilters): number {
  return [
    filters.states.length > 0,
    filters.role !== 'all',
    filters.types.length > 0,
    Boolean(filters.dateFrom || filters.dateTo),
  ].filter(Boolean).length
}

/** Catch what CourtControl would reject before asking (it only checks the range order). */
export function validateHistoryFilters(filters: HistoryFilters): HistoryFilterErrors {
  if (filters.dateFrom && filters.dateTo && filters.dateTo < filters.dateFrom) {
    return { dateTo: 'Must be on or after the start date.' }
  }
  return {}
}

export function hasHistoryErrors(errors: HistoryFilterErrors): boolean {
  return Object.values(errors).some(Boolean)
}

const API_FIELD_TO_FILTER: Record<string, HistoryField> = {
  state: 'states',
  role: 'role',
  booking_type: 'types',
  date_from: 'dateFrom',
  date_to: 'dateTo',
}

/** Map a 400 from the reservations list onto the filter controls. */
export function serverHistoryFilterErrors(error: unknown): HistoryFilterErrors {
  if (!(error instanceof ApiError) || error.status !== 400) return {}
  const errors: HistoryFilterErrors = {}
  const general: string[] = []
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const text = messages.map((message) => message.replace(/`/g, '')).join(' ')
    const target = API_FIELD_TO_FILTER[field]
    if (target && !errors[target]) errors[target] = text
    else general.push(text)
  }
  if (general.length) errors.general = general.join(' ')
  if (!hasHistoryErrors(errors)) errors.general = error.message.replace(/`/g, '')
  return errors
}
