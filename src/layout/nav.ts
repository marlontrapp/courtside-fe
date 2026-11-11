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
]
