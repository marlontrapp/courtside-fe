import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ManagedCourt } from '@/api/clubs'
import { ClubCourtsPage } from '@/pages/admin/ClubCourtsPage'
import { makeMe, makeWorkingClub } from '@/test/factories'
import { jsonResponse, mockFetch, requestedUrls } from '@/test/fetch'
import { renderWithProviders } from '@/test/render'

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

function renderCourts() {
  return renderWithProviders(<ClubCourtsPage />, {
    route: '/manage/courts',
    auth: { user: makeMe({ clubs: [club] }) },
    workspace: {
      workspace: { kind: 'club', clubId: club.id, role: 'ADMIN' },
      club,
      role: 'ADMIN',
    },
  })
}

describe('Club courts', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=test-csrf-token'
  })

  it('lists courts and creates one', async () => {
    const user = userEvent.setup()
    let courts: ManagedCourt[] = []
    const fetchMock = mockFetch((url, init) => {
      const method = init?.method ?? 'GET'
      if (!url.pathname.endsWith('/courts/') && !url.pathname.includes('/courts/')) {
        return jsonResponse({ detail: 'nope' }, 404)
      }
      if (method === 'GET') return jsonResponse(courts)
      if (method === 'POST') {
        const body = JSON.parse(String(init?.body)) as Partial<ManagedCourt>
        const created: ManagedCourt = {
          ...clay,
          id: 'court-new',
          name: body.name ?? 'Court',
          surface_type: body.surface_type ?? 'CLAY',
          hourly_rate: body.hourly_rate ?? '0.00',
          lighting_fee: body.lighting_fee ?? '0.00',
          is_indoor: Boolean(body.is_indoor),
          is_singles_only: Boolean(body.is_singles_only),
          has_lighting: body.has_lighting !== false,
          is_active: true,
        }
        courts = [created]
        return jsonResponse(created, 201)
      }
      return jsonResponse({ detail: 'nope' }, 404)
    })

    renderCourts()

    expect(await screen.findByText('No courts yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New court' }))

    const dialog = () => screen.getByRole('dialog')
    await user.type(within(dialog()).getByLabelText('Name'), 'Court 1 - Guga')
    await user.clear(within(dialog()).getByLabelText('Hourly rate'))
    await user.type(within(dialog()).getByLabelText('Hourly rate'), '120')
    await user.clear(within(dialog()).getByLabelText('Lighting fee'))
    await user.type(within(dialog()).getByLabelText('Lighting fee'), '30')
    await user.click(within(dialog()).getByRole('button', { name: 'Create court' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Created Court 1 - Guga.')
    expect(
      await screen.findByRole('article', { name: 'Court 1 - Guga' }),
    ).toBeInTheDocument()
    expect(requestedUrls(fetchMock)).toContain('/api/v1/clubs/jardins/courts/')
  })

  it('edits a court and offers force when deactivating with bookings', async () => {
    const user = userEvent.setup()
    let courts = [clay]
    mockFetch((url, init) => {
      const method = init?.method ?? 'GET'
      if (!url.pathname.includes('/courts')) {
        return jsonResponse({ detail: 'nope' }, 404)
      }
      if (method === 'GET') return jsonResponse(courts)
      if (method === 'PATCH') {
        const body = JSON.parse(String(init?.body)) as { is_active?: boolean; force?: boolean }
        if (body.is_active === false && !body.force) {
          return jsonResponse(
            {
              detail: '1 future booking(s) on this court',
              conflicting_reservations: [
                {
                  id: 'r1',
                  court_name: 'Court 1 - Guga',
                  start: '2030-01-10T11:00:00-03:00',
                  end: '2030-01-10T12:00:00-03:00',
                  primary_player: { id: 'p1', first_name: 'Ana', last_name: 'Silva' },
                  status: 'CONFIRMED',
                },
              ],
              hint: 'force=true',
            },
            409,
          )
        }
        const updated = { ...clay, is_active: false }
        courts = [updated]
        return jsonResponse({
          ...updated,
          cancelled_reservations: body.force
            ? [
                {
                  id: 'r1',
                  court_name: 'Court 1 - Guga',
                  start: '2030-01-10T11:00:00-03:00',
                  end: '2030-01-10T12:00:00-03:00',
                  primary_player: { id: 'p1', first_name: 'Ana', last_name: 'Silva' },
                  status: 'CONFIRMED',
                },
              ]
            : [],
        })
      }
      return jsonResponse({ detail: 'nope' }, 404)
    })

    renderCourts()

    const card = await screen.findByRole('article', { name: 'Court 1 - Guga' })
    await user.click(within(card).getByRole('button', { name: /Edit/ }))

    const dialog = () => screen.getByRole('dialog')
    await user.click(within(dialog()).getByLabelText(/Active/))
    await user.click(within(dialog()).getByRole('button', { name: 'Save changes' }))

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(/1 future booking/)
    await user.click(
      within(dialog()).getByRole('button', { name: /Cancel 1 booking and deactivate/ }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Saved Court 1 - Guga.')
    expect(await screen.findByText('Inactive')).toBeInTheDocument()
  })

  it('blocks delete when the court has booking history', async () => {
    const user = userEvent.setup()
    mockFetch((url, init) => {
      const method = init?.method ?? 'GET'
      if (!url.pathname.includes('/courts')) {
        return jsonResponse({ detail: 'nope' }, 404)
      }
      if (method === 'GET') return jsonResponse([clay])
      if (method === 'DELETE') {
        return jsonResponse(
          { detail: "This court has bookings, so it can't be deleted — deactivate it instead." },
          409,
        )
      }
      return jsonResponse({ detail: 'nope' }, 404)
    })

    renderCourts()
    const card = await screen.findByRole('article', { name: 'Court 1 - Guga' })
    await user.click(within(card).getByRole('button', { name: /Delete/ }))

    const dialog = () => screen.getByRole('dialog')
    await user.click(within(dialog()).getByRole('button', { name: 'Delete court' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(/deactivate it instead/i)
    expect(within(dialog()).getByRole('button', { name: 'Edit instead' })).toBeInTheDocument()
  })
})
