import type { ClubSummary, Court, CourtPage } from '@/api/courts'
import type { Me, WorkingClub } from '@/api/me'
import type { PlayerSummary, Reservation, ReservationPage } from '@/api/reservations'

let sequence = 0
const nextId = (prefix: string) => `${prefix}-${++sequence}`

export function makePlayer(overrides: Partial<PlayerSummary> = {}): PlayerSummary {
  return {
    id: nextId('player'),
    first_name: 'Pat',
    last_name: 'Player',
    ...overrides,
  }
}

export function makeClub(overrides: Partial<ClubSummary> = {}): ClubSummary {
  const id = overrides.id ?? nextId('club')
  return {
    id,
    name: 'Ibirapuera Tennis Center',
    slug: id,
    timezone: 'America/Sao_Paulo',
    access_type: 'OPEN',
    ...overrides,
  }
}

export const IBIRAPUERA = makeClub({ id: 'club-ibirapuera' })

export function makeCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: nextId('court'),
    name: 'Court 1 - Guga',
    surface_type: 'CLAY',
    is_indoor: false,
    has_lighting: true,
    hourly_rate: '120.00',
    lighting_fee: '30.00',
    club: IBIRAPUERA,
    available_slots: [
      { start: '2030-01-08T17:00:00-03:00', end: '2030-01-08T18:00:00-03:00' },
      { start: '2030-01-08T18:00:00-03:00', end: '2030-01-08T19:00:00-03:00' },
    ],
    notices: [],
    ...overrides,
  }
}

/** A DRF page. Pass `hasNext` when more pages follow (DRF sends an absolute `next` URL). */
export function makePage(
  results: Court[],
  {
    count = results.length,
    page = 1,
    hasNext = false,
  }: { count?: number; page?: number; hasNext?: boolean } = {},
): CourtPage {
  const pageUrl = (n: number) => `http://127.0.0.1:8000/api/v1/courts/?page=${n}`
  return {
    count,
    next: hasNext ? pageUrl(page + 1) : null,
    previous: page > 1 ? pageUrl(page - 1) : null,
    results,
  }
}

/** A confirmed, upcoming reservation the signed-in user booked (2030-01-09 18:00–19:00). */
export function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: nextId('reservation'),
    court: {
      id: 'court-guga',
      name: 'Court 1 - Guga',
      club: { id: IBIRAPUERA.id, name: IBIRAPUERA.name, timezone: IBIRAPUERA.timezone },
    },
    start: '2030-01-09T18:00:00-03:00',
    end: '2030-01-09T19:00:00-03:00',
    booking_type: 'SINGLES',
    status: 'CONFIRMED',
    state: 'upcoming',
    role: 'owner',
    primary_player: makePlayer({ id: 'player-self', first_name: 'Pat', last_name: 'Player' }),
    includes_lighting: false,
    total_price: '120.00',
    guests: [],
    notes: '',
    can_cancel: true,
    cancellation_deadline: '2030-01-08T18:00:00-03:00',
    ...overrides,
  }
}

/** A DRF page of reservations. */
export function makeReservationPage(
  results: Reservation[],
  { count = results.length, page = 1, hasNext = false } = {},
): ReservationPage {
  return {
    count,
    next: hasNext ? `http://127.0.0.1:8000/api/v1/reservations/?page=${page + 1}` : null,
    results,
  }
}

/** A club the signed-in user works in (defaults: Ibirapuera, club admin). */
export function makeWorkingClub(overrides: Partial<WorkingClub> = {}): WorkingClub {
  return {
    id: IBIRAPUERA.id,
    name: IBIRAPUERA.name,
    slug: IBIRAPUERA.slug,
    address: 'Av. Pedro Álvares Cabral, São Paulo',
    timezone: IBIRAPUERA.timezone,
    access_type: 'OPEN',
    is_active: true,
    roles: ['ADMIN'],
    ...overrides,
  }
}

/** The signed-in user (default: a player with no club roles). */
export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    id: 'user-1',
    email: 'player@example.com',
    first_name: 'Pat',
    last_name: 'Player',
    is_player: true,
    is_site_staff: false,
    clubs: [],
    ...overrides,
  }
}
