import { CLUB_ROLES, type ClubRole, type Me, type WorkingClub } from '@/api/me'

/**
 * How the user acts in a club: a staff role they hold there, or — for site
 * staff without one — `SITE_STAFF` (CourtControl lets site staff run any club).
 */
export type ActingRole = ClubRole | 'SITE_STAFF'

/** How the user is using Courtside right now. Club work is one club at a time. */
export type Workspace =
  { kind: 'player' } | { kind: 'club'; clubId: string; role: ActingRole }

export const ROLE_LABELS: Record<ActingRole, string> = {
  ADMIN: 'Club admin',
  GROUNDSKEEPER: 'Groundskeeper',
  FRONT_DESK: 'Front desk',
  SITE_STAFF: 'Site staff',
}

export const ROLE_DESCRIPTIONS: Record<ActingRole, string> = {
  ADMIN: 'Run the club: courts, schedules, day templates, closures.',
  GROUNDSKEEPER: 'Court upkeep: the schedule, repairs, unplayable courts.',
  FRONT_DESK: 'The desk: bookings for walk-in players, no-shows.',
  SITE_STAFF: 'Courtside staff: work in any club.',
}

const ROLE_ORDER: ActingRole[] = [...CLUB_ROLES, 'SITE_STAFF']

/** Roles the user can act with in `club` (site staff without a role there act as SITE_STAFF). */
export function rolesIn(club: WorkingClub, me: Me): ActingRole[] {
  const roles = club.roles.filter((role): role is ClubRole =>
    (CLUB_ROLES as readonly string[]).includes(role),
  )
  return roles.length ? roles : me.is_site_staff ? ['SITE_STAFF'] : []
}

/** "Club admin · Front desk" */
export function roleSummary(club: WorkingClub, me: Me): string {
  return rolesIn(club, me)
    .map((role) => ROLE_LABELS[role])
    .join(' · ')
}

export type ActingOption =
  { kind: 'player' } | { kind: 'club'; role: ActingRole; clubs: WorkingClub[] }

/** Every way the user can act: as a player, and per role with the clubs it covers. */
export function actingOptions(me: Me): ActingOption[] {
  const options: ActingOption[] = me.is_player ? [{ kind: 'player' }] : []
  for (const role of ROLE_ORDER) {
    const clubs = me.clubs.filter((club) => rolesIn(club, me).includes(role))
    if (clubs.length) options.push({ kind: 'club', role, clubs })
  }
  return options
}

/** Club admins and site staff manage schedules (CourtControl returns 404 to other roles). */
export function canManageSchedules(role: ActingRole): boolean {
  return role === 'ADMIN' || role === 'SITE_STAFF'
}

/** Still allowed? (Roles end, clubs go; a saved workspace may be stale.) */
export function isWorkspaceValid(workspace: Workspace, me: Me): boolean {
  if (workspace.kind === 'player') return me.is_player
  const club = me.clubs.find((item) => item.id === workspace.clubId)
  return Boolean(club && rolesIn(club, me).includes(workspace.role))
}

/**
 * The role to use after switching to `club`: keep the current one if held
 * there, else the club's first (admin before groundskeeper before front desk).
 */
export function roleForClub(
  club: WorkingClub,
  me: Me,
  current?: ActingRole,
): ActingRole | null {
  const roles = rolesIn(club, me)
  if (current && roles.includes(current)) return current
  return roles[0] ?? null
}

/** Where each kind of workspace starts. */
export function workspaceHome(workspace: Workspace): string {
  return workspace.kind === 'player' ? '/' : '/manage'
}

/** The only possible workspace, when there's no choice to make. */
export function onlyWorkspace(me: Me): Workspace | null {
  const options = actingOptions(me)
  if (options.length !== 1) return null
  const [option] = options
  if (option.kind === 'player') return { kind: 'player' }
  return option.clubs.length === 1
    ? { kind: 'club', clubId: option.clubs[0].id, role: option.role }
    : null
}

// --- Persistence: remember the last workspace per user (survives reloads). ---------

const storageKey = (userId: string) => `courtside.workspace.${userId}`

export function loadWorkspace(userId: string): Workspace | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<Workspace> & Record<string, unknown>
    if (value.kind === 'player') return { kind: 'player' }
    if (
      value.kind === 'club' &&
      typeof value.clubId === 'string' &&
      typeof value.role === 'string' &&
      (ROLE_ORDER as string[]).includes(value.role)
    ) {
      return { kind: 'club', clubId: value.clubId, role: value.role as ActingRole }
    }
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  return null
}

export function saveWorkspace(userId: string, workspace: Workspace | null): void {
  try {
    if (workspace)
      window.localStorage.setItem(storageKey(userId), JSON.stringify(workspace))
    else window.localStorage.removeItem(storageKey(userId))
  } catch {
    // Storage unavailable (private mode): the choice lasts for this page only.
  }
}
