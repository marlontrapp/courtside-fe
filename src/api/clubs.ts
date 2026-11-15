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
export const clubCourtsQueryKey = (clubId: string) =>
  [...clubQueryKey(clubId), 'courts'] as const

/** Surfaces CourtControl accepts on a managed court. */
export const COURT_SURFACES = ['CLAY', 'HARD', 'GRASS', 'SYNTHETIC'] as const
export type CourtSurface = (typeof COURT_SURFACES)[number]

const managedCourtSchema = z.object({
  id: z.string(),
  name: z.string(),
  surface_type: z.string(),
  is_indoor: z.boolean(),
  is_singles_only: z.boolean(),
  has_lighting: z.boolean(),
  /** Decimal string from CourtControl, e.g. "120.00". */
  hourly_rate: z.string(),
  lighting_fee: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type ManagedCourt = z.infer<typeof managedCourtSchema>

export type ManagedCourtInput = {
  name: string
  surface_type: CourtSurface
  is_indoor: boolean
  is_singles_only: boolean
  has_lighting: boolean
  hourly_rate: string
  lighting_fee: string
  is_active: boolean
}

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
const courtsPath = (clubId: string) => `${clubPath(clubId)}courts/`
const courtPath = (clubId: string, id: string) =>
  `${courtsPath(clubId)}${encodeURIComponent(id)}/`

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

/** Every court of the club, including inactive (club admins / site staff). */
export function fetchClubCourts(clubId: string): Promise<ManagedCourt[]> {
  return getParsed(courtsPath(clubId), z.array(managedCourtSchema), 'club courts')
}

export async function createClubCourt(
  clubId: string,
  input: ManagedCourtInput,
): Promise<ManagedCourt> {
  const data = await apiJson<unknown>(courtsPath(clubId), {
    method: 'POST',
    body: input,
  })
  const parsed = managedCourtSchema.safeParse(data)
  if (!parsed.success) throw unexpected('court')
  return parsed.data
}

export type ManagedCourtChange = {
  court: ManagedCourt
  /** Future bookings cancelled when deactivating with `force`. */
  cancelled: AffectedBooking[]
}

/**
 * Patch any subset of court settings. Deactivating with future bookings:
 * 409 with `conflicting_reservations`, or `force` to cancel them.
 */
export async function updateClubCourt(
  clubId: string,
  id: string,
  changes: Partial<ManagedCourtInput> & { force?: boolean },
): Promise<ManagedCourtChange> {
  const data = await apiJson<unknown>(courtPath(clubId, id), {
    method: 'PATCH',
    body: changes,
  })
  const parsed = managedCourtSchema
    .extend({ cancelled_reservations: z.array(affectedBookingSchema).default([]) })
    .safeParse(data)
  if (!parsed.success) throw unexpected('court')
  const { cancelled_reservations: cancelled, ...court } = parsed.data
  return { court, cancelled }
}

/**
 * Delete a court with no booking history. Courts with bookings: 409 (deactivate
 * instead). Linked to booking rules: 409, or `force` to unlink first.
 */
export async function deleteClubCourt(
  clubId: string,
  id: string,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  const path = force
    ? `${courtPath(clubId, id)}?force=true`
    : courtPath(clubId, id)
  await apiJson<void>(path, { method: 'DELETE' })
}

/** The bookings a 409 says a change would cancel (empty for other errors). */
export function conflictingBookings(error: unknown): AffectedBooking[] {
  if (!(error instanceof ApiError) || error.status !== 409) return []
  const parsed = z
    .object({ conflicting_reservations: z.array(affectedBookingSchema) })
    .safeParse(error.body)
  return parsed.success ? parsed.data.conflicting_reservations : []
}

// --- Court weekly schedules (day templates per weekday) -----------------------------

export const WORKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
] as const
export const WEEKEND = ['SATURDAY', 'SUNDAY'] as const

const templateRefSchema = z
  .object({ id: z.string(), name: z.string() })
  .nullable()

const courtScheduleSchema = z.object({
  id: z.string(),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  state: z.string(),
  days: z.array(
    z.object({
      weekdays: z.array(z.string()),
      day_template: templateRefSchema,
    }),
  ),
})

export type CourtSchedule = z.infer<typeof courtScheduleSchema>

export type ScheduleDayAssignment = {
  weekdays: string[]
  /** Template id, or null to close those days. */
  day_template: string | null
}

export type CourtScheduleInput = {
  valid_from: string
  valid_until?: string | null
  days: ScheduleDayAssignment[]
  force?: boolean
}

export type CourtScheduleChange = {
  schedule: CourtSchedule
  cancelled: AffectedBooking[]
}

const schedulesPath = (courtId: string) =>
  `/api/v1/courts/${encodeURIComponent(courtId)}/schedules/`

export const courtSchedulesQueryKey = (courtId: string) =>
  ['courts', courtId, 'schedules'] as const

/** Every weekly schedule version for a court (past, current, planned). */
export function fetchCourtSchedules(courtId: string): Promise<CourtSchedule[]> {
  return getParsed(schedulesPath(courtId), z.array(courtScheduleSchema), 'court schedules')
}

/**
 * Plan a new weekly schedule version from `valid_from` (today or later).
 * Future bookings that no longer fit: 409, or `force` to cancel them.
 */
export async function createCourtSchedule(
  courtId: string,
  input: CourtScheduleInput,
): Promise<CourtScheduleChange> {
  const data = await apiJson<unknown>(schedulesPath(courtId), {
    method: 'POST',
    body: input,
  })
  const parsed = courtScheduleSchema
    .extend({ cancelled_reservations: z.array(affectedBookingSchema).default([]) })
    .safeParse(data)
  if (!parsed.success) throw unexpected('court schedule')
  const { cancelled_reservations: cancelled, ...schedule } = parsed.data
  return { schedule, cancelled }
}

/** The schedule in effect today, if any. */
export function currentSchedule(
  schedules: CourtSchedule[],
): CourtSchedule | null {
  return schedules.find((item) => item.state === 'current') ?? null
}

/**
 * Templates linked on workdays / weekend of a schedule version.
 * Returns null ids when those days are closed or the mapping isn't a simple
 * workdays+weekend split.
 */
export function scheduleTemplateIds(schedule: CourtSchedule | null): {
  workdays: string | null
  weekend: string | null
} {
  if (!schedule) return { workdays: null, weekend: null }
  const byDay = new Map<string, string | null>()
  for (const group of schedule.days) {
    for (const day of group.weekdays) {
      byDay.set(day, group.day_template?.id ?? null)
    }
  }
  const workdayIds = WORKDAYS.map((day) => byDay.get(day) ?? null)
  const weekendIds = WEEKEND.map((day) => byDay.get(day) ?? null)
  const same = (ids: Array<string | null>) =>
    ids.every((id) => id === ids[0]) ? ids[0] : undefined
  const workdays = same(workdayIds)
  const weekend = same(weekendIds)
  return {
    workdays: workdays === undefined ? null : workdays,
    weekend: weekend === undefined ? null : weekend,
  }
}
