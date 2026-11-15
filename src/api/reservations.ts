import { z } from 'zod'

import { ApiError, apiJson } from '@/api/client'

/** Booking types a player may choose (staff-only TOURNAMENT/BLOCKED are rejected). */
export const PLAYER_BOOKING_TYPES = ['SINGLES', 'DOUBLES', 'LESSON'] as const
export type BookingType = (typeof PLAYER_BOOKING_TYPES)[number]

/** CourtControl's `MAX_GUESTS`: doubles is the booker + 3. */
export const MAX_GUESTS = 3
/** `notes` max_length on the reservation serializer. */
export const MAX_NOTES_LENGTH = 500

/**
 * `POST /api/v1/reservations/` body. `date` and times are wall-clock in the
 * court's club timezone; `end_time` may be "24:00" (midnight).
 */
export type ReservationRequest = {
  court: string
  date: string
  start_time: string
  end_time: string
  booking_type: BookingType
  includes_lighting: boolean
  guests: string[]
  notes: string
}

const reservationSchema = z.object({
  id: z.string(),
  court: z.object({
    id: z.string(),
    name: z.string(),
    club: z.object({ id: z.string(), name: z.string(), timezone: z.string() }),
  }),
  start: z.string(),
  end: z.string(),
  booking_type: z.string(),
  status: z.string(),
  /** Lifecycle bucket: upcoming, pending_payment, completed, cancelled, expired. */
  state: z.string(),
  /** Relative to the signed-in user: "owner" (booked it) or "guest". */
  role: z.string(),
  /** Email of the player who booked. */
  primary_player: z.string(),
  includes_lighting: z.boolean(),
  total_price: z.string(),
  guests: z.array(z.string()),
  notes: z.string(),
  /** Whether the booker may cancel right now (club cancellation policy). */
  can_cancel: z.boolean(),
  cancellation_deadline: z.string().nullable(),
  /** When it was cancelled (ISO, server timezone) — null unless cancelled. */
  cancelled_at: z.string().nullable().optional(),
  /** The reason the booker gave when cancelling ("" if none). */
  cancellation_reason: z.string().optional(),
})

export type Reservation = z.infer<typeof reservationSchema>

const reservationPageSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  results: z.array(reservationSchema),
})

export type ReservationPage = z.infer<typeof reservationPageSchema>

/** Everything under this key depends on the user's reservations (refresh after booking). */
export const RESERVATIONS_QUERY_KEY = ['reservations'] as const
export const UPCOMING_RESERVATIONS_QUERY_KEY = [
  ...RESERVATIONS_QUERY_KEY,
  'upcoming',
] as const

export const RESERVATION_HISTORY_QUERY_KEY = [
  ...RESERVATIONS_QUERY_KEY,
  'history',
] as const

/** Lifecycle states CourtControl filters by (`state=`). */
export const RESERVATION_STATES = [
  'upcoming',
  'pending_payment',
  'completed',
  'cancelled',
  'expired',
] as const
export type ReservationState = (typeof RESERVATION_STATES)[number]

/** `GET /api/v1/reservations/` params (see ReservationFilter); blank values are dropped. */
export type ReservationListParams = Partial<
  Record<
    | 'state'
    | 'date'
    | 'date_from'
    | 'date_to'
    | 'time_from'
    | 'time_to'
    | 'player'
    | 'role'
    | 'club'
    | 'court'
    | 'booking_type'
    | 'ordering',
    string
  >
>

/**
 * One page of the user's reservations (as booker or guest). Pagination is by
 * page number: DRF's `next` is an absolute URL on the API host, which would
 * bypass the dev proxy.
 */
export async function fetchReservations(
  params: ReservationListParams,
  page = 1,
): Promise<ReservationPage> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  if (page > 1) search.set('page', String(page))

  let data: unknown
  try {
    data = await apiJson<unknown>(`/api/v1/reservations/?${search}`)
  } catch (error) {
    if (error instanceof SyntaxError) throw unexpectedList()
    throw error
  }
  const parsed = reservationPageSchema.safeParse(data)
  if (!parsed.success) throw unexpectedList()
  return parsed.data
}

/**
 * Bookings that haven't finished, soonest first. `upcoming` includes bookings
 * in progress; unpaid holds are `pending_payment`.
 */
export function fetchUpcomingReservations(page = 1): Promise<ReservationPage> {
  return fetchReservations({ state: 'upcoming,pending_payment', ordering: 'start' }, page)
}

function unexpectedList(): ApiError {
  return new ApiError(
    'CourtControl sent an unexpected reservations response. Is the API proxy pointing at CourtControl?',
    0,
  )
}

/**
 * Book a court. Payment isn't implemented in CourtControl yet, so a successful
 * booking comes back CONFIRMED.
 *
 * 400: invalid request or slot not bookable (`fieldErrors`, incl. `non_field_errors`)
 * 409: slot already taken.
 */
export async function createReservation(
  request: ReservationRequest,
): Promise<Reservation> {
  const data = await apiJson<unknown>('/api/v1/reservations/', {
    method: 'POST',
    body: request,
  })
  const parsed = reservationSchema.safeParse(data)
  if (!parsed.success) {
    // The booking went through; only the confirmation payload is off.
    throw new ApiError(
      'Your court was booked, but CourtControl sent an unexpected confirmation.',
      0,
    )
  }
  return parsed.data
}

/** `reason` max_length on the cancel serializer. */
export const MAX_CANCEL_REASON_LENGTH = 500

/**
 * Cancel a booking (booker only), per the club's cancellation policy. Idempotent:
 * repeating it on a booking you already cancelled returns 200 again, so retries are safe.
 *
 * 403: you're a guest · 404: not found / not yours ·
 * 409: can't be cancelled anymore (`detail` says why: deadline passed, started, …).
 */
export async function cancelReservation(id: string, reason = ''): Promise<Reservation> {
  const data = await apiJson<unknown>(
    `/api/v1/reservations/${encodeURIComponent(id)}/cancel/`,
    {
      method: 'POST',
      body: { reason: reason.trim() },
    },
  )
  const parsed = reservationSchema.safeParse(data)
  if (!parsed.success) {
    throw new ApiError(
      'Your booking was cancelled, but CourtControl sent an unexpected confirmation.',
      0,
    )
  }
  return parsed.data
}
