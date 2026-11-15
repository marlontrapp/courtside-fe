import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ManagedCourt } from '@/api/clubs'
import { ClubCourtsPage } from '@/pages/admin/ClubCourtsPage'
import { makeMe, makeWorkingClub } from '@/test/factories'
import { freezeDate, renderWithProviders } from '@/test/render'
import { jsonResponse, mockFetch, requestedUrls } from '@/test/fetch'

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

const weekdaysTemplate = {
  id: 'tpl-weekdays',
  name: 'Weekdays',
  slots: [{ start: '08:00', end: '09:00' }],
  locked: false,
}

const weekendTemplate = {
  id: 'tpl-weekend',
  name: 'Weekend',
  slots: [{ start: '09:00', end: '10:30' }],
  locked: false,
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

const dialog = () => screen.getByRole('dialog')

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  field: string,
  value: string | RegExp,
) {
  await user.click(await within(dialog()).findByRole('button', { name: field }))
  await user.click(
    within(screen.getByRole('listbox', { name: field })).getByRole('option', {
      name: value,
    }),
  )
}

type Handler = (url: URL, method: string, body: unknown) => Response | undefined

function mockClubApi(override?: Handler) {
  let courts: ManagedCourt[] = []
  const fetchMock = mockFetch((url, init) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const custom = override?.(url, method, body)
    if (custom) return custom

    if (url.pathname.endsWith('/day-templates/')) {
      return jsonResponse([weekdaysTemplate, weekendTemplate])
    }
    if (url.pathname.includes('/schedules/')) {
      if (method === 'POST') {
        return jsonResponse({
          id: 'sched-1',
          valid_from: '2030-01-08',
          valid_until: null,
          state: 'current',
          days: [
            {
              weekdays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
              day_template: { id: weekdaysTemplate.id, name: weekdaysTemplate.name },
            },
            {
              weekdays: ['SATURDAY', 'SUNDAY'],
              day_template: body?.days?.[1]?.day_template
                ? { id: weekendTemplate.id, name: weekendTemplate.name }
                : null,
            },
          ],
          cancelled_reservations: [],
        }, 201)
      }
      return jsonResponse([])
    }
    if (url.pathname.includes('/courts')) {
      if (method === 'GET' && url.pathname.endsWith('/courts/')) return jsonResponse(courts)
      if (method === 'POST' && url.pathname.endsWith('/courts/')) {
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
      if (method === 'PATCH') {
        const updated = { ...clay, ...body, id: clay.id, name: body.name ?? clay.name }
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
        courts = [{ ...clay, is_active: body.is_active ?? clay.is_active, name: updated.name }]
        return jsonResponse({
          ...courts[0],
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
      if (method === 'DELETE') {
        return jsonResponse(
          { detail: "This court has bookings, so it can't be deleted — deactivate it instead." },
          409,
        )
      }
      if (method === 'GET') return jsonResponse(courts)
    }
    return jsonResponse({ detail: 'nope' }, 404)
  })
  return {
    fetchMock,
    setCourts: (next: ManagedCourt[]) => {
      courts = next
    },
  }
}

describe('Club courts', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=test-csrf-token'
    freezeDate('2030-01-08T12:00:00-03:00')
  })

  it('lists courts and creates one with a day-template schedule', async () => {
    const user = userEvent.setup()
    const { fetchMock } = mockClubApi()

    renderCourts()

    expect(await screen.findByText('No courts yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New court' }))

    await user.type(await within(dialog()).findByLabelText('Name'), 'Court 1 - Guga')
    await user.clear(within(dialog()).getByLabelText('Hourly rate'))
    await user.type(within(dialog()).getByLabelText('Hourly rate'), '120')
    await user.clear(within(dialog()).getByLabelText('Lighting fee'))
    await user.type(within(dialog()).getByLabelText('Lighting fee'), '30')
    await pick(user, 'Mon–Fri', /Weekdays/)
    await pick(user, 'Sat–Sun', /Weekend/)
    await user.click(within(dialog()).getByRole('button', { name: 'Create court' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Created Court 1 - Guga.')
    expect(
      await screen.findByRole('article', { name: 'Court 1 - Guga' }),
    ).toBeInTheDocument()
    expect(requestedUrls(fetchMock)).toContain('/api/v1/clubs/jardins/courts/')
    expect(requestedUrls(fetchMock)).toContain('/api/v1/courts/court-new/schedules/')
    const schedulePost = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).includes('/schedules/') && init?.method === 'POST',
    )
    expect(JSON.parse(String(schedulePost?.[1]?.body))).toMatchObject({
      valid_from: '2030-01-08',
      days: [
        {
          weekdays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
          day_template: 'tpl-weekdays',
        },
        {
          weekdays: ['SATURDAY', 'SUNDAY'],
          day_template: 'tpl-weekend',
        },
      ],
    })
  })

  it('edits a court and offers force when deactivating with bookings', async () => {
    const user = userEvent.setup()
    const { setCourts } = mockClubApi()
    setCourts([clay])

    renderCourts()

    const card = await screen.findByRole('article', { name: 'Court 1 - Guga' })
    await user.click(within(card).getByRole('button', { name: /Edit/ }))

    await user.click(within(dialog()).getByLabelText(/Active/))
    await user.click(within(dialog()).getByRole('button', { name: 'Save changes' }))

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(/1 future booking/)
    await user.click(
      within(dialog()).getByRole('button', { name: /Cancel 1 booking and save/ }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Saved Court 1 - Guga.')
    expect(await screen.findByText('Inactive')).toBeInTheDocument()
  })

  it('blocks delete when the court has booking history', async () => {
    const user = userEvent.setup()
    const { setCourts } = mockClubApi()
    setCourts([clay])

    renderCourts()
    const card = await screen.findByRole('article', { name: 'Court 1 - Guga' })
    await user.click(within(card).getByRole('button', { name: /Delete/ }))

    await user.click(within(dialog()).getByRole('button', { name: 'Delete court' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(/deactivate it instead/i)
    expect(within(dialog()).getByRole('button', { name: 'Edit instead' })).toBeInTheDocument()
  })
})
