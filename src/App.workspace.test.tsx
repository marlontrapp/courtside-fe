import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Me } from '@/api/me'
import { AppRoutes } from '@/App'
import { AuthProvider } from '@/auth/AuthProvider'
import { makeMe, makePage, makeReservationPage, makeWorkingClub } from '@/test/factories'
import { jsonResponse, mockFetch } from '@/test/fetch'
import { LocationProbe } from '@/test/LocationProbe'
import { createTestQueryClient } from '@/test/render'
import { WorkspaceProvider } from '@/workspace/WorkspaceProvider'
import { saveWorkspace } from '@/workspace/workspace'

const jardins = makeWorkingClub({
  id: 'jardins',
  name: 'Jardins Country Club',
  address: 'Rua Estados Unidos, São Paulo',
  roles: ['ADMIN', 'GROUNDSKEEPER'],
})
const lisboa = makeWorkingClub({
  id: 'lisboa',
  name: 'Lisboa Tennis Club',
  address: 'Av. da Liberdade, Lisboa',
  roles: ['FRONT_DESK'],
})
const morumbi = makeWorkingClub({
  id: 'morumbi',
  name: 'Morumbi Racquet Club',
  roles: ['ADMIN'],
})

const clubDetail = (club: typeof jardins) => ({
  id: club.id,
  name: club.name,
  slug: club.slug,
  address: club.address,
  timezone: 'America/Sao_Paulo',
  access_type: 'MEMBERS_ONLY',
  cancellation_window_hours: 24,
  is_active: true,
})

/** Fake CourtControl; `state.me` null = signed out. */
function mockBackend(me: Me | null) {
  const state = { me }
  mockFetch((url, init) => {
    const path = url.pathname
    if (path === '/api/v1/me/') {
      return state.me
        ? jsonResponse(state.me)
        : jsonResponse({ detail: 'Authentication credentials were not provided.' }, 403)
    }
    if (path === '/api-auth/login/' && init?.method === 'POST') {
      state.me = me
      return new Response(null, { status: 302 })
    }
    if (path === '/api-auth/login/') return new Response('<form></form>', { status: 200 })
    if (path === '/api-auth/logout/') {
      state.me = null
      return new Response(null, { status: 200 })
    }
    if (path === '/api/v1/reservations/') return jsonResponse(makeReservationPage([]))
    if (path === '/api/v1/courts/') return jsonResponse(makePage([]))
    const club = /^\/api\/v1\/clubs\/([^/]+)\/$/.exec(path)
    if (club) {
      const found = [jardins, lisboa, morumbi].find((item) => item.id === club[1])!
      return jsonResponse(clubDetail(found))
    }
    if (/\/courts\/$/.test(path)) return jsonResponse([])
    if (/day-templates\/$/.test(path)) return jsonResponse([])
    return jsonResponse({ detail: 'Not found.' }, 404)
  })
  return state
}

function renderApp(route: string) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AuthProvider>
        <WorkspaceProvider>
          <MemoryRouter initialEntries={[route]}>
            <AppRoutes />
            <LocationProbe />
          </MemoryRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

const location = () => screen.getByTestId('location')
const sidePanel = () => screen.getByRole('complementary')
const mainNav = () => screen.getByRole('navigation', { name: 'Main' })
const navLabels = () =>
  within(mainNav())
    .getAllByRole('link')
    .map((link) => link.querySelector('span')?.textContent)

describe('Choosing how to act', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.cookie = 'csrftoken=test-csrf-token'
  })

  it('asks after signing in', async () => {
    const user = userEvent.setup()
    mockBackend(null)
    // Signing in answers the backend as this user from then on.
    const state = mockBackend(makeMe({ first_name: 'Bruno', clubs: [jardins, lisboa] }))
    state.me = null
    renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'bruno@example.com')
    await user.type(screen.getByLabelText('Password'), 'player123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByRole('heading', { name: 'How do you want to continue?' }),
    ).toBeInTheDocument()
    expect(location()).toHaveTextContent('/start')
    expect(screen.getByText('Hi, Bruno')).toBeInTheDocument()
  })

  it('offers each way to act, with the clubs each role covers', async () => {
    mockBackend(makeMe({ clubs: [jardins, lisboa, morumbi] }))
    renderApp('/start')

    const list = await screen.findByRole('list', { name: 'How do you want to continue?' })
    const cards = within(list).getAllByRole('button')
    expect(cards.map((card) => card.querySelector('p')?.textContent)).toEqual([
      'Player',
      'Club admin',
      'Groundskeeper',
      'Front desk',
    ])
    expect(cards[1]).toHaveTextContent('2 clubs')
    expect(cards[3]).toHaveTextContent('Lisboa Tennis Club')
  })

  it('goes straight home when playing is the only way to act', async () => {
    mockBackend(makeMe())
    renderApp('/start')

    expect(await screen.findByRole('heading', { name: "You're in." })).toBeInTheDocument()
    expect(location()).toHaveTextContent(/^\/$/)
    expect(screen.queryByRole('button', { name: 'Switch role' })).not.toBeInTheDocument()
  })

  it('opens the club directly when a role covers a single club', async () => {
    const user = userEvent.setup()
    mockBackend(makeMe({ clubs: [jardins, lisboa] }))
    renderApp('/start')

    await user.click(await screen.findByRole('button', { name: /^Club admin/ }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Jardins Country Club' }),
    ).toBeInTheDocument()
    expect(location()).toHaveTextContent('/manage')
    // Side panel: role, club (a switcher: roles in two clubs), address.
    expect(within(sidePanel()).getByText('Club admin')).toBeInTheDocument()
    expect(within(sidePanel()).getByRole('button', { name: 'Club' })).toHaveTextContent(
      'Jardins Country Club',
    )
    expect(
      within(sidePanel()).getByText('Rua Estados Unidos, São Paulo'),
    ).toBeInTheDocument()
    expect(navLabels()).toEqual(['Overview', 'Courts', 'Day templates'])
    expect(screen.getByRole('button', { name: 'Switch role' })).toBeInTheDocument()
  })

  it('asks for the club when a role covers several — one club at a time', async () => {
    const user = userEvent.setup()
    mockBackend(makeMe({ clubs: [jardins, morumbi] }))
    renderApp('/start')

    await user.click(await screen.findByRole('button', { name: /^Club admin/ }))

    expect(
      screen.getByRole('heading', { name: 'Which club are you working at?' }),
    ).toBeInTheDocument()
    const clubs = within(
      screen.getByRole('list', { name: 'Which club are you working at?' }),
    )
    expect(
      clubs.getAllByRole('button').map((card) => card.querySelector('p')?.textContent),
    ).toEqual(['Jardins Country Club', 'Morumbi Racquet Club'])

    await user.click(screen.getByRole('button', { name: /Choose another way/ }))
    expect(
      screen.getByRole('heading', { name: 'How do you want to continue?' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Club admin/ }))
    await user.click(screen.getByRole('button', { name: /^Morumbi Racquet Club/ }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Morumbi Racquet Club' }),
    ).toBeInTheDocument()
  })

  it('skips straight to the clubs for staff-only accounts with one role', async () => {
    const ibirapuera = makeWorkingClub({
      id: 'ibirapuera',
      name: 'Ibirapuera',
      roles: ['ADMIN'],
    })
    mockBackend(makeMe({ is_player: false, clubs: [ibirapuera, morumbi] }))
    renderApp('/start')

    expect(
      await screen.findByRole('heading', { name: 'Which club are you working at?' }),
    ).toBeInTheDocument()
    // Nothing to go back to.
    expect(
      screen.queryByRole('button', { name: /Choose another way/ }),
    ).not.toBeInTheDocument()
  })

  it('explains accounts with nothing to open, and lets them sign out', async () => {
    const user = userEvent.setup()
    mockBackend(makeMe({ is_player: false }))
    renderApp('/start')

    expect(
      await screen.findByRole('heading', { name: 'Nothing to open yet' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(location()).toHaveTextContent('/login')
  })
})

describe('Working in a club', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.cookie = 'csrftoken=test-csrf-token'
  })

  it('switches club from the side panel, listing each club with its roles', async () => {
    const user = userEvent.setup()
    const me = makeMe({ clubs: [jardins, lisboa] })
    mockBackend(me)
    saveWorkspace(me.id, { kind: 'club', clubId: 'jardins', role: 'GROUNDSKEEPER' })
    renderApp('/manage')

    await screen.findByRole('heading', { level: 1, name: 'Jardins Country Club' })
    await user.click(within(sidePanel()).getByRole('button', { name: 'Club' }))
    const options = within(screen.getByRole('listbox', { name: 'Club' })).getAllByRole(
      'option',
    )
    expect(options.map((option) => option.textContent?.replace('✓', ''))).toEqual([
      'Jardins Country ClubClub admin · Groundskeeper',
      'Lisboa Tennis ClubFront desk',
    ])

    await user.click(options[1])

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lisboa Tennis Club' }),
    ).toBeInTheDocument()
    // The only role there.
    expect(within(sidePanel()).getByText('Front desk')).toBeInTheDocument()
    expect(navLabels()).toEqual(['Overview'])
    expect(
      JSON.parse(window.localStorage.getItem(`courtside.workspace.${me.id}`)!),
    ).toEqual({
      kind: 'club',
      clubId: 'lisboa',
      role: 'FRONT_DESK',
    })
  })

  it('shows a plain club name when there is nothing to switch to', async () => {
    const me = makeMe({ is_player: false, clubs: [lisboa] })
    mockBackend(me)
    renderApp('/start')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lisboa Tennis Club' }),
    ).toBeInTheDocument()
    expect(
      within(sidePanel()).queryByRole('button', { name: 'Club' }),
    ).not.toBeInTheDocument()
    expect(within(sidePanel()).getByText('Lisboa Tennis Club')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Switch role' })).not.toBeInTheDocument()
  })

  it('shows the club logo when CourtControl provides one', async () => {
    const me = makeMe({
      is_player: false,
      clubs: [{ ...lisboa, logo_url: '/media/lisboa.png' }],
    })
    mockBackend(me)
    renderApp('/start')

    await screen.findByRole('heading', { level: 1, name: 'Lisboa Tennis Club' })
    expect(sidePanel().querySelector('img')).toHaveAttribute('src', '/media/lisboa.png')
  })

  it('switches back to playing from "Switch role"', async () => {
    const user = userEvent.setup()
    const me = makeMe({ clubs: [jardins] })
    mockBackend(me)
    saveWorkspace(me.id, { kind: 'club', clubId: 'jardins', role: 'ADMIN' })
    renderApp('/manage')

    await user.click(await screen.findByRole('button', { name: 'Switch role' }))
    await user.click(await screen.findByRole('button', { name: /^Player/ }))

    expect(await screen.findByRole('heading', { name: "You're in." })).toBeInTheDocument()
    expect(navLabels()).toEqual(['Home', 'Clubs', 'Players', 'Courts', 'Bookings'])
  })
})

describe('Guards and remembered choices', () => {
  beforeEach(() => window.localStorage.clear())

  it('restores the last workspace after a reload', async () => {
    const me = makeMe({ clubs: [jardins] })
    mockBackend(me)
    saveWorkspace(me.id, { kind: 'club', clubId: 'jardins', role: 'ADMIN' })

    renderApp('/')

    // A club workspace doesn't show player pages.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Jardins Country Club' }),
    ).toBeInTheDocument()
    expect(location()).toHaveTextContent('/manage')
  })

  it('asks again when the remembered role is gone', async () => {
    const me = makeMe({ clubs: [lisboa] })
    mockBackend(me)
    saveWorkspace(me.id, { kind: 'club', clubId: 'jardins', role: 'ADMIN' })

    renderApp('/manage')

    expect(
      await screen.findByRole('heading', { name: 'How do you want to continue?' }),
    ).toBeInTheDocument()
  })

  it('keeps players out of club pages', async () => {
    const me = makeMe({ clubs: [jardins] })
    mockBackend(me)
    saveWorkspace(me.id, { kind: 'player' })

    renderApp('/manage/day-templates')

    expect(await screen.findByRole('heading', { name: "You're in." })).toBeInTheDocument()
    expect(location()).toHaveTextContent(/^\/$/)
  })

  it('keeps schedule tools to admins', async () => {
    const me = makeMe({ clubs: [lisboa] })
    mockBackend(me)
    saveWorkspace(me.id, { kind: 'club', clubId: 'lisboa', role: 'FRONT_DESK' })

    renderApp('/manage/day-templates')

    await waitFor(() => expect(location()).toHaveTextContent(/^\/manage$/))
    expect(
      await screen.findByText(/Tools for front desk aren’t available yet/),
    ).toBeInTheDocument()
  })

  it('sends signed-out visitors to sign in', async () => {
    mockBackend(null)
    renderApp('/start')

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
