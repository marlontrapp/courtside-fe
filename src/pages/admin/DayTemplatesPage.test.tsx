import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import type { DayTemplate } from '@/api/clubs'
import { DayTemplatesPage } from '@/pages/admin/DayTemplatesPage'
import { makeMe, makeWorkingClub } from '@/test/factories'
import { jsonResponse, mockFetch } from '@/test/fetch'
import { freezeDate, renderWithProviders } from '@/test/render'

type User = ReturnType<typeof userEvent.setup>

const club = makeWorkingClub({
  id: 'ibi',
  name: 'Ibirapuera Tennis Center',
  roles: ['ADMIN'],
})
const hourly = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, index) => {
    const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00`
    return { start: pad(from + index), end: pad(from + index + 1) }
  })

const weekdays: DayTemplate = {
  id: 't1',
  name: 'Weekdays',
  slots: hourly(7, 22),
  locked: true,
}
const holiday: DayTemplate = {
  id: 't2',
  name: 'Holiday',
  slots: hourly(9, 12),
  locked: false,
}

const conflictBody = {
  detail: '1 future booking(s) wouldn’t fit the new schedule.',
  conflicting_reservations: [
    {
      id: 'r1',
      court: 'c1',
      court_name: 'Court 1 - Guga',
      start: '2030-01-10T11:00:00-03:00',
      end: '2030-01-10T12:00:00-03:00',
      primary_player: { id: 'p1', first_name: 'Ana', last_name: 'Silva' },
      status: 'CONFIRMED',
    },
  ],
  hint: 'Pick a later start date, or send force=true to cancel these bookings.',
}

type Handler = (
  method: string,
  path: string,
  body: unknown,
) => Response | Promise<Response>

/** Fake CourtControl: the day-template endpoints of `club`, backed by `api.templates`. */
function mockApi(templates: DayTemplate[] = [weekdays, holiday], override?: Handler) {
  const api = { templates: [...templates] }
  const fetchMock = mockFetch(async (url, init) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const custom = await override?.(method, url.pathname, body)
    if (custom) return custom
    if (method === 'GET') return jsonResponse(api.templates)
    if (method === 'POST') {
      const created = { id: `t${api.templates.length + 1}`, locked: false, ...body }
      api.templates = [...api.templates, created]
      return jsonResponse(created, 201)
    }
    const id = url.pathname.split('/').at(-2)
    if (method === 'PATCH') {
      api.templates = api.templates.map((item) =>
        item.id === id
          ? {
              ...item,
              ...(body.name ? { name: body.name } : {}),
              ...(body.slots ? { slots: body.slots } : {}),
            }
          : item,
      )
      return jsonResponse({
        ...api.templates.find((item) => item.id === id)!,
        cancelled_reservations: [],
      })
    }
    api.templates = api.templates.filter((item) => item.id !== id)
    return new Response(null, { status: 204 })
  })
  const writes = () =>
    fetchMock.mock.calls
      .filter(([, init]) => init?.method && init.method !== 'GET')
      .map(([input, init]) => ({
        method: init!.method,
        url: String(input),
        body: init!.body ? JSON.parse(String(init!.body)) : undefined,
      }))
  return { api, writes }
}

function renderPage() {
  return renderWithProviders(<DayTemplatesPage />, {
    route: '/manage/day-templates',
    auth: { user: makeMe({ clubs: [club] }) },
    workspace: {
      workspace: { kind: 'club', clubId: club.id, role: 'ADMIN' },
      club,
      role: 'ADMIN',
    },
  })
}

const dialog = () => screen.getByRole('dialog')

async function pick(user: User, field: string, value: string) {
  await user.click(within(dialog()).getByRole('button', { name: field }))
  await user.click(
    within(screen.getByRole('listbox', { name: field })).getByRole('option', {
      name: value,
    }),
  )
}

describe('Day templates', () => {
  beforeEach(() => {
    freezeDate('2030-01-08T12:00:00-03:00')
    document.cookie = 'csrftoken=test-csrf-token'
  })

  it('lists the club’s templates with their slots', async () => {
    mockApi()
    renderPage()

    const card = await screen.findByRole('article', { name: 'Weekdays' })
    expect(
      within(card).getByText('15 slots · 07:00–22:00 · 60 min each'),
    ).toBeInTheDocument()
    expect(within(card).getByText('Slots locked')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Edit Weekdays' })).toHaveTextContent(
      'Rename',
    )
    expect(within(card).getAllByRole('listitem')).toHaveLength(15)

    const open = screen.getByRole('article', { name: 'Holiday' })
    expect(within(open).queryByText('Slots locked')).not.toBeInTheDocument()
    expect(within(open).getByRole('button', { name: 'Edit Holiday' })).toHaveTextContent(
      'Edit',
    )
  })

  it('explains day templates when there are none', async () => {
    mockApi([])
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'No day templates yet' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'New template' })).toHaveLength(1)
  })

  it('creates a template by filling the day', async () => {
    const user = userEvent.setup()
    const { writes } = mockApi([])
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'New template' }))

    await user.type(within(dialog()).getByLabelText('Name'), 'Weekend')
    await pick(user, 'Opens', '09:00')
    await pick(user, 'Closes', '13:00')
    await user.click(within(dialog()).getByRole('radio', { name: '90 min' }))
    expect(within(dialog()).getByText(/^2 slots — replaces/)).toBeInTheDocument()
    await user.click(within(dialog()).getByRole('button', { name: 'Fill slots' }))
    expect(
      within(dialog()).getByText(/^2 slots · 09:00–12:00 · 90 min each/),
    ).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('button', { name: 'Create template' }))

    expect(await screen.findByText('Created Weekend.')).toBeInTheDocument()
    expect(writes()).toEqual([
      {
        method: 'POST',
        url: '/api/v1/clubs/ibi/day-templates/',
        body: {
          name: 'Weekend',
          slots: [
            { start: '09:00', end: '10:30' },
            { start: '10:30', end: '12:00' },
          ],
        },
      },
    ])
    expect(await screen.findByRole('article', { name: 'Weekend' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('builds slots by hand, checking them before saving', async () => {
    const user = userEvent.setup()
    const { writes } = mockApi([])
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'New template' }))
    await user.type(within(dialog()).getByLabelText('Name'), 'Evenings')

    await user.click(within(dialog()).getByRole('button', { name: 'Add slot' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Add slot' }))
    // Second slot follows the first: 09:00–10:00; pull it back to overlap.
    await pick(user, 'Slot 2 start', '08:30')
    await user.click(within(dialog()).getByRole('button', { name: 'Create template' }))

    expect(within(dialog()).getByText('Overlaps 08:00–09:00.')).toBeInTheDocument()
    expect(writes()).toEqual([])

    await user.click(within(dialog()).getByRole('button', { name: /Remove slot 2/ }))
    await user.click(within(dialog()).getByRole('button', { name: 'Create template' }))

    expect(await screen.findByText('Created Evenings.')).toBeInTheDocument()
    expect(writes()[0].body).toEqual({
      name: 'Evenings',
      slots: [{ start: '08:00', end: '09:00' }],
    })
  })

  it('needs a name', async () => {
    const user = userEvent.setup()
    const { writes } = mockApi([])
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'New template' }))

    await user.click(within(dialog()).getByRole('button', { name: 'Create template' }))

    expect(within(dialog()).getByText(/Give the template a name/)).toBeInTheDocument()
    expect(within(dialog()).getByLabelText('Name')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(writes()).toEqual([])
  })

  it('shows CourtControl’s validation on the fields', async () => {
    const user = userEvent.setup()
    mockApi([weekdays], (method) =>
      method === 'POST'
        ? jsonResponse(
            { name: 'This club already has a day template with this name.' },
            400,
          )
        : undefined!,
    )
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'New template' }))
    await user.type(within(dialog()).getByLabelText('Name'), 'Weekdays')

    await user.click(within(dialog()).getByRole('button', { name: 'Create template' }))

    expect(
      await within(dialog()).findByText(
        'This club already has a day template with this name.',
      ),
    ).toBeInTheDocument()
  })

  it('renames a locked template without touching its slots', async () => {
    const user = userEvent.setup()
    const { writes } = mockApi()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Edit Weekdays' }))

    expect(within(dialog()).getByText(/can’t change anymore/)).toBeInTheDocument()
    expect(
      within(dialog()).queryByRole('button', { name: /Slot 1 start/ }),
    ).not.toBeInTheDocument()
    await user.clear(within(dialog()).getByLabelText('Name'))
    await user.type(within(dialog()).getByLabelText('Name'), 'Workdays')
    await user.click(within(dialog()).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Saved Workdays.')).toBeInTheDocument()
    expect(writes()).toEqual([
      {
        method: 'PATCH',
        url: '/api/v1/clubs/ibi/day-templates/t1/',
        body: { name: 'Workdays' },
      },
    ])
  })

  it('sends only the slots when they change', async () => {
    const user = userEvent.setup()
    const { writes } = mockApi()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Edit Holiday' }))

    await user.click(within(dialog()).getByRole('button', { name: /Remove slot 3/ }))
    await user.click(within(dialog()).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Saved Holiday.')).toBeInTheDocument()
    expect(writes()[0].body).toEqual({ slots: hourly(9, 11) })
  })

  it('lists the bookings a change would cancel, and cancels them only on request', async () => {
    const user = userEvent.setup()
    const { writes } = mockApi(undefined, (method, _path, body) => {
      if (method !== 'PATCH') return undefined!
      const { force } = body as { force?: boolean }
      return force
        ? jsonResponse({
            ...holiday,
            slots: hourly(9, 11),
            cancelled_reservations: conflictBody.conflicting_reservations,
          })
        : jsonResponse(conflictBody, 409)
    })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Edit Holiday' }))
    await user.click(within(dialog()).getByRole('button', { name: /Remove slot 3/ }))
    await user.click(within(dialog()).getByRole('button', { name: 'Save changes' }))

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      '1 future booking doesn’t fit the new slots.',
    )
    const affected = within(dialog()).getByRole('list', {
      name: 'Bookings that would be cancelled',
    })
    expect(affected).toHaveTextContent(
      'Thu, Jan 10, 11:00–12:00 · Court 1 - Guga · Ana Silva',
    )
    expect(within(dialog()).getByText(/doesn’t notify the players/)).toBeInTheDocument()

    await user.click(
      within(dialog()).getByRole('button', { name: 'Cancel 1 booking and save' }),
    )

    expect(await screen.findByText('Saved Holiday.')).toBeInTheDocument()
    expect(writes().map((write) => write.body)).toEqual([
      { slots: hourly(9, 11) },
      { slots: hourly(9, 11), force: true },
    ])
    // The outcome keeps the list, to tell the players.
    expect(screen.getByText(/These bookings were cancelled/)).toBeInTheDocument()
    expect(screen.getByText(/Court 1 - Guga · Ana Silva/)).toBeInTheDocument()
  })

  describe('deleting', () => {
    it('asks first, starting on the safe choice, then deletes', async () => {
      const user = userEvent.setup()
      const { writes } = mockApi()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Delete Holiday' }))

      const confirm = screen.getByRole('dialog', { name: 'Delete template?' })
      expect(within(confirm).getByRole('button', { name: 'Keep it' })).toHaveFocus()
      await user.click(within(confirm).getByRole('button', { name: 'Delete template' }))

      const notice = await screen.findByText('Deleted Holiday.')
      await waitFor(() => expect(notice.closest('[tabindex="-1"]')).toHaveFocus())
      expect(writes()).toEqual([
        { method: 'DELETE', url: '/api/v1/clubs/ibi/day-templates/t2/', body: undefined },
      ])
      await waitFor(() =>
        expect(
          screen.queryByRole('article', { name: 'Holiday' }),
        ).not.toBeInTheDocument(),
      )
    })

    it('explains templates still in use', async () => {
      const user = userEvent.setup()
      mockApi(undefined, (method) =>
        method === 'DELETE'
          ? jsonResponse(
              {
                detail:
                  "This template is used by a schedule or an override, so it can't be deleted.",
              },
              409,
            )
          : undefined!,
      )
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Delete Weekdays' }))

      const confirm = screen.getByRole('dialog', { name: 'Delete template?' })
      await user.click(within(confirm).getByRole('button', { name: 'Delete template' }))

      expect(await within(confirm).findByRole('alert')).toHaveTextContent(
        "This template is used by a schedule or an override, so it can't be deleted.",
      )
      expect(
        within(confirm).getByRole('button', { name: 'Delete template' }),
      ).toBeDisabled()
    })
  })

  it('explains a failure to load and retries', async () => {
    const user = userEvent.setup()
    let fail = true
    mockApi(undefined, (method) =>
      method === 'GET' && fail ? new Response('', { status: 502 }) : undefined!,
    )
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "CourtControl couldn't load the day templates right now (502).",
    )
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('article', { name: 'Weekdays' })).toBeInTheDocument()
  })
})
