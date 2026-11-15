import { z } from 'zod'

import { ApiError, apiJson } from '@/api/client'
import { playerSummarySchema } from '@/api/reservations'

const clubSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  address: z.string(),
  timezone: z.string(),
  access_type: z.string(),
  /** Players can cancel a confirmed booking up to this many hours before it starts. */
  cancellation_window_hours: z.number(),
  is_active: z.boolean(),
})

export type ClubDetail = z.infer<typeof clubSchema>

const slotSchema = z.object({ start: z.string(), end: z.string() })

const dayTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Wall-clock slots in the club's timezone, "HH:MM"; "24:00" = midnight. */
  slots: z.array(slotSchema),
  /** True once the template has been in effect: its slots can't change anymore. */
  locked: z.boolean(),
})

export type TemplateSlot = z.infer<typeof slotSchema>
export type DayTemplate = z.infer<typeof dayTemplateSchema>

/** A booking a schedule change cancelled (with `force`) or would cancel (409). */
const affectedBookingSchema = z.object({
  id: z.string(),
  court_name: z.string(),
  start: z.string(),
  end: z.string(),
  primary_player: playerSummarySchema,
  status: z.string(),
})

export type AffectedBooking = z.infer<typeof affectedBookingSchema>

export const CLUBS_QUERY_KEY = ['clubs'] as const
export const clubQueryKey = (clubId: string) => [...CLUBS_QUERY_KEY, clubId] as const
export const dayTemplatesQueryKey = (clubId: string) =>
  [...clubQueryKey(clubId), 'day-templates'] as const

function unexpected(what: string): ApiError {
  return new ApiError(
    `CourtControl sent an unexpected ${what} response. Is the API proxy pointing at CourtControl?`,
    0,
  )
}

async function getParsed<T>(
  path: string,
  schema: z.ZodType<T>,
  what: string,
): Promise<T> {
  let data: unknown
  try {
    data = await apiJson<unknown>(path)
  } catch (error) {
    if (error instanceof SyntaxError) throw unexpected(what)
    throw error
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw unexpected(what)
  return parsed.data
}

const clubPath = (clubId: string) => `/api/v1/clubs/${encodeURIComponent(clubId)}/`
const templatesPath = (clubId: string) => `${clubPath(clubId)}day-templates/`
const templatePath = (clubId: string, id: string) =>
  `${templatesPath(clubId)}${encodeURIComponent(id)}/`

/** `GET /api/v1/clubs/<id>/` — any signed-in user. */
export function fetchClub(clubId: string): Promise<ClubDetail> {
  return getParsed(clubPath(clubId), clubSchema, 'club')
}

/** The club's day templates (club admins and site staff; 404 for others). */
export function fetchDayTemplates(clubId: string): Promise<DayTemplate[]> {
  return getParsed(templatesPath(clubId), z.array(dayTemplateSchema), 'day templates')
}

export type DayTemplateInput = { name: string; slots: TemplateSlot[] }

export async function createDayTemplate(
  clubId: string,
  input: DayTemplateInput,
): Promise<DayTemplate> {
  const data = await apiJson<unknown>(templatesPath(clubId), {
    method: 'POST',
    body: input,
  })
  const parsed = dayTemplateSchema.safeParse(data)
  if (!parsed.success) throw unexpected('day template')
  return parsed.data
}

export type DayTemplateChange = {
  template: DayTemplate
  /** Future bookings cancelled because they no longer fit (only with `force`). */
  cancelled: AffectedBooking[]
}

/**
 * Rename anytime; change `slots` only while the template isn't `locked`
 * (409 after). Future bookings that wouldn't fit: 409 with the
 * `conflicting_reservations` — or, with `force`, they're cancelled.
 */
export async function updateDayTemplate(
  clubId: string,
  id: string,
  changes: Partial<DayTemplateInput> & { force?: boolean },
): Promise<DayTemplateChange> {
  const data = await apiJson<unknown>(templatePath(clubId, id), {
    method: 'PATCH',
    body: changes,
  })
  const parsed = dayTemplateSchema
    .extend({ cancelled_reservations: z.array(affectedBookingSchema).default([]) })
    .safeParse(data)
  if (!parsed.success) throw unexpected('day template')
  const { cancelled_reservations: cancelled, ...template } = parsed.data
  return { template, cancelled }
}

/** Only when no schedule or override uses it (409 otherwise). */
export async function deleteDayTemplate(clubId: string, id: string): Promise<void> {
  await apiJson<void>(templatePath(clubId, id), { method: 'DELETE' })
}

/** The bookings a 409 says a change would cancel (empty for other errors). */
export function conflictingBookings(error: unknown): AffectedBooking[] {
  if (!(error instanceof ApiError) || error.status !== 409) return []
  const parsed = z
    .object({ conflicting_reservations: z.array(affectedBookingSchema) })
    .safeParse(error.body)
  return parsed.success ? parsed.data.conflicting_reservations : []
}
