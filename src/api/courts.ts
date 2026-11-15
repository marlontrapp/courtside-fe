import { z } from 'zod'

import { ApiError, apiJson } from '@/api/client'

/** Shapes mirror CourtControl's `GET /api/v1/courts/` (CourtAvailabilitySerializer). */
const clubSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  access_type: z.string(),
})

const timeSlotSchema = z.object({
  start: z.string(),
  end: z.string(),
})

const noticeSchema = z.object({
  date: z.string(),
  type: z.string(),
  notes: z.string(),
})

const courtSchema = z.object({
  id: z.string(),
  name: z.string(),
  surface_type: z.string(),
  is_indoor: z.boolean(),
  has_lighting: z.boolean(),
  hourly_rate: z.string(),
  lighting_fee: z.string(),
  club: clubSummarySchema,
  available_slots: z.array(timeSlotSchema),
  notices: z.array(noticeSchema),
})

const courtPageSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(courtSchema),
})

export type ClubSummary = z.infer<typeof clubSummarySchema>
export type CourtTimeSlot = z.infer<typeof timeSlotSchema>
export type CourtNotice = z.infer<typeof noticeSchema>
export type Court = z.infer<typeof courtSchema>
export type CourtPage = z.infer<typeof courtPageSchema>

export const COURTS_QUERY_KEY = ['courts', 'list'] as const
export const BOOKABLE_CLUBS_QUERY_KEY = ['courts', 'clubs'] as const

/** Query params for `GET /api/v1/courts/`; blank values are dropped. */
export type CourtListParams = Record<string, string | undefined>

function courtsPath(params: CourtListParams, page: number): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  if (page > 1) search.set('page', String(page))
  const query = search.toString()
  return query ? `/api/v1/courts/?${query}` : '/api/v1/courts/'
}

/**
 * One page of bookable courts with their free slots in the requested window
 * (today when no date/time params are given).
 *
 * Pagination is by page number: DRF's `next` is an absolute URL on the API host,
 * which would bypass the Vite proxy (and its same-origin session cookie).
 */
export async function fetchCourts(
  params: CourtListParams = {},
  page = 1,
): Promise<CourtPage> {
  let data: unknown
  try {
    data = await apiJson<unknown>(courtsPath(params, page))
  } catch (error) {
    // A 200 with a non-JSON body (e.g. an HTML page from another app on the port).
    if (error instanceof SyntaxError) throw unexpectedResponse()
    throw error
  }

  const parsed = courtPageSchema.safeParse(data)
  if (!parsed.success) throw unexpectedResponse()
  return parsed.data
}

/** Safety stop for the page walk below (25 courts per page → 1,250 courts). */
const MAX_CLUB_PAGES = 50

/**
 * Every club the user can book at, by name. CourtControl has no club listing
 * endpoint, so this walks the unfiltered court list — without window params it
 * includes every bookable court, even ones with no free slot today.
 */
export async function fetchBookableClubs(): Promise<ClubSummary[]> {
  const clubs = new Map<string, ClubSummary>()
  for (let page = 1; page <= MAX_CLUB_PAGES; page += 1) {
    const result = await fetchCourts({}, page)
    for (const court of result.results) clubs.set(court.club.id, court.club)
    if (!result.next) break
  }
  return [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function unexpectedResponse(): ApiError {
  return new ApiError(
    'CourtControl sent an unexpected courts response. Is the API proxy pointing at CourtControl?',
    0,
  )
}
