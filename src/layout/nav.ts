export type NavItem = {
  to: string
  label: string
  description: string
}

export const APP_NAV: NavItem[] = [
  {
    to: '/',
    label: 'Home',
    description: 'Overview',
  },
  {
    to: '/clubs',
    label: 'Clubs',
    description: 'Find clubs',
  },
  {
    to: '/players',
    label: 'Players',
    description: 'Find players',
  },
  {
    to: '/courts',
    label: 'Courts',
    description: 'Find courts',
  },
  {
    to: '/bookings',
    label: 'Bookings',
    description: 'Booking history',
  },
]

/** Club workspace pages. `schedules`: club admins and site staff only. */
export type ClubNavItem = NavItem & { schedules?: boolean }

export const CLUB_NAV: ClubNavItem[] = [
  {
    to: '/manage',
    label: 'Overview',
    description: 'The club at a glance',
  },
  {
    to: '/manage/day-templates',
    label: 'Day templates',
    description: 'Slot lists for schedules',
    schedules: true,
  },
]
