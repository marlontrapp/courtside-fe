import { z } from 'zod'

import { ApiError, apiJson } from '@/api/client'

/** Staff roles a user can hold in a club (`ClubStaffRole.Role`). */
export const CLUB_ROLES = ['ADMIN', 'GROUNDSKEEPER', 'FRONT_DESK'] as const
export type ClubRole = (typeof CLUB_ROLES)[number]

const workingClubSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  address: z.string(),
  timezone: z.string(),
  access_type: z.string(),
  is_active: z.boolean(),
  /** Roles held today; empty for site staff without a role in this club. */
  roles: z.array(z.string()),
  /** Not provided by CourtControl yet; shown when present. */
  logo_url: z.string().nullable().optional(),
})

const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  /** Has a player profile: can act as a player. */
  is_player: z.boolean(),
  /** Site-wide staff: can work in every club. */
  is_site_staff: z.boolean(),
  /** Clubs the user can work in, by name. */
  clubs: z.array(workingClubSchema),
})

export type WorkingClub = z.infer<typeof workingClubSchema>
export type Me = z.infer<typeof meSchema>

/**
 * The signed-in user (`GET /api/v1/me/`), or null when signed out (401/403).
 * Doubles as the session probe.
 */
export async function fetchMe(): Promise<Me | null> {
  let data: unknown
  try {
    data = await apiJson<unknown>('/api/v1/me/')
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403))
      return null
    if (error instanceof SyntaxError) throw unexpectedMe()
    throw error
  }
  const parsed = meSchema.safeParse(data)
  if (!parsed.success) throw unexpectedMe()
  return parsed.data
}

function unexpectedMe(): ApiError {
  return new ApiError(
    'CourtControl sent an unexpected account response. Is the API proxy pointing at CourtControl?',
    0,
  )
}
