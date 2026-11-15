import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ManagedCourt } from '@/api/clubs'
import { OverridesPage } from '@/pages/admin/OverridesPage'
import { makeMe, makeWorkingClub } from '@/test/factories'
import { jsonResponse, mockFetch, requestedUrls } from '@/test/fetch'
import { freezeDate, renderWithProviders } from '@/test/render'

const club = makeWorkingClub({ id: 'jardins', name: 'Jardins Country Club' })

const clay: ManagedCourt = {
  id: 'court-1',
  name: 'Court 1 - Guga',
  surface_type: 'CLAY',
  is_indoor: false,
  is_singles_only: false,
  has_lighting: true,
  hourly_rate: '120.00',
  lighting_fee: '30.00',
  is_active: true,
  created_at: '2030-01-01T10:00:00-03:00',
  updated_at: '2030-01-01T10:00:00-03:00',
}

const hard: ManagedCourt = {
  ...clay,
  id: 'court-2',
  name: 'Court 2 - Hard',
  surface_type: 'HARD',
}

const weekdaysTemplate = {
  id: 'tpl-weekdays',
  name: 'Weekdays',
  slots: [{ start: '08:00', end: '09:00' }],
  locked: false,
}

function renderPage() {
  return renderWithProviders(<OverridesPage />, {
    route: '/manage/overrides',
    auth: { user: makeMe({ clubs: [club] }) },
    workspace: {
      workspace: { kind: 'club', clubId: club.id, role: 'ADMIN' },
      club,
      role: 'ADMIN',
    },
  })
}

const dialog = () => screen.getByRole('dialog')

describe('Overrides', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=test-csrf-token'
    freezeDate('2030-01-08T12:00:00-03:00')
  })

  it('lists upcoming overrides and creates one on two courts', async () => {
    const user = userEvent.setup()
    const overridesByCourt: Record<string, unknown[]> = {
      'court-1': [],
      'court-2': [],
    }
    const fetchMock = mockFetch((url, init) => {
      const method = init?.method ?? 'GET'
      const path = url.pathname

      if (path.endsWith('/day-templates/')) return jsonResponse([weekdaysTemplate])
      if (path.endsWith('/courts/') && method === 'GET') return jsonResponse([clay, hard])

      const courtMatch = /\/courts\/([^/]+)\/overrides\/?$/.exec(path)
      if (courtMatch && method === 'GET') {
        return jsonResponse(overridesByCourt[courtMatch[1]!] ?? [])
      }

      const putMatch = /\/courts\/([^/]+)\/overrides\/([^/]+)\/$/.exec(path)
      if (putMatch && method === 'PUT') {
        const courtId = putMatch[1]!
        const date = putMatch[2]!
        const body = JSON.parse(String(init?.body)) as {
          type: string
          notes: string
          day_template: string | null
        }
        const courtName = courtId === 'court-1' ? clay.name : hard.name
        const created = {
          date,
          type: body.type,
          notes: body.notes,
          day_template: body.day_template
            ? { id: weekdaysTemplate.id, name: weekdaysTemplate.name }
            : null,
          slots: body.day_template ? weekdaysTemplate.slots : [],
          created_at: '2030-01-08T12:00:00-03:00',
          updated_at: '2030-01-08T12:00:00-03:00',
          cancelled_reservations: [],
        }
        overridesByCourt[courtId] = [created]
        return jsonResponse(created)
      }

      return jsonResponse({ detail: 'nope' }, 404)
    })

    renderPage()

    expect(await screen.findByText('No upcoming overrides')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New override' }))

    await within(dialog()).findByLabelText('Date')

    await user.click(within(dialog()).getByRole('button', { name: 'Reason' }))
    await user.click(
      within(screen.getByRole('listbox', { name: 'Reason' })).getByRole('option', {
        name: 'Weather',
      }),
    )

    await user.type(within(dialog()).getByLabelText(/Notes/), 'Rain all day')

    await user.click(within(dialog()).getByRole('button', { name: 'Create override' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Saved override on 2 courts.')
    expect(
      await screen.findByRole('article', { name: /Court 1 - Guga/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('article', { name: /Court 2 - Hard/ }),
    ).toBeInTheDocument()

    const puts = requestedUrls(fetchMock).filter((url) =>
      url.includes('/overrides/2030-01-08/'),
    )
    expect(puts).toEqual([
      '/api/v1/courts/court-1/overrides/2030-01-08/',
      '/api/v1/courts/court-2/overrides/2030-01-08/',
    ])
  })

  it('removes an override', async () => {
    const user = userEvent.setup()
    let listed = [
      {
        date: '2030-01-10',
        type: 'TOURNAMENT',
        notes: 'Juniors',
        day_template: { id: 'tpl-weekdays', name: 'Weekdays' },
        slots: [{ start: '08:00', end: '09:00' }],
        created_at: '2030-01-08T12:00:00-03:00',
        updated_at: '2030-01-08T12:00:00-03:00',
      },
    ]
    mockFetch((url, init) => {
      const method = init?.method ?? 'GET'
      const path = url.pathname
      if (path.endsWith('/day-templates/')) return jsonResponse([weekdaysTemplate])
      if (path.endsWith('/courts/') && method === 'GET') return jsonResponse([clay])
      if (path.includes('/overrides/') && method === 'GET') return jsonResponse(listed)
      if (method === 'DELETE') {
        listed = []
        return jsonResponse({ cancelled_reservations: [] })
      }
      return jsonResponse({ detail: 'nope' }, 404)
    })

    renderPage()
    const card = await screen.findByRole('article', { name: /Court 1 - Guga/ })
    await user.click(
      within(card).getByRole('button', { name: 'Delete override for Court 1 - Guga' }),
    )
    await user.click(within(dialog()).getByRole('button', { name: 'Remove override' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Removed override/)
    expect(await screen.findByText('No upcoming overrides')).toBeInTheDocument()
  })
})
