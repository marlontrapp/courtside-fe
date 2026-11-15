import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { ActingRole } from '@/workspace/workspace'
import { ClubOverviewPage } from '@/pages/admin/ClubOverviewPage'
import { makeMe, makeWorkingClub } from '@/test/factories'
import { jsonResponse, mockFetch } from '@/test/fetch'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/render'

const club = makeWorkingClub({
  id: 'jardins',
  name: 'Jardins Country Club',
  address: 'Rua Estados Unidos, São Paulo',
  roles: ['ADMIN', 'GROUNDSKEEPER'],
})

const detail = {
  id: 'jardins',
  name: 'Jardins Country Club',
  slug: 'jardins',
  address: 'Rua Estados Unidos, São Paulo',
  timezone: 'America/Sao_Paulo',
  access_type: 'MEMBERS_ONLY',
  cancellation_window_hours: 12,
  is_active: true,
}

function renderOverview(role: ActingRole = 'ADMIN') {
  return renderWithProviders(
    <>
      <ClubOverviewPage />
      <LocationProbe />
    </>,
    {
      route: '/manage',
      auth: { user: makeMe({ clubs: [club] }) },
      workspace: { workspace: { kind: 'club', clubId: club.id, role }, club, role },
    },
  )
}

describe('Club overview', () => {
  it('shows the club, its settings, and the roles held there', async () => {
    mockFetch(() => jsonResponse(detail))

    renderOverview()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Jardins Country Club' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Rua Estados Unidos, São Paulo')).toBeInTheDocument()

    const settings = screen.getByRole('region', { name: 'Club settings' })
    expect(await within(settings).findByText('Members only')).toBeInTheDocument()
    expect(within(settings).getByText('America/Sao Paulo')).toBeInTheDocument()
    expect(
      within(settings).getByText('Up to 12 hours before the start'),
    ).toBeInTheDocument()
    expect(within(settings).getByText('Active — listed for players')).toBeInTheDocument()

    const roles = screen.getByRole('region', { name: 'Your roles here' })
    expect(
      within(roles)
        .getByText(/Club admin/)
        .closest('p'),
    ).toHaveTextContent('(acting now)')
    expect(within(roles).getByText(/Groundskeeper/)).toBeInTheDocument()
  })

  it('flags an inactive club and a no-window policy', async () => {
    mockFetch(() =>
      jsonResponse({ ...detail, is_active: false, cancellation_window_hours: 0 }),
    )

    renderOverview()

    const settings = screen.getByRole('region', { name: 'Club settings' })
    expect(await within(settings).findByText('Inactive')).toBeInTheDocument()
    expect(within(settings).getByText('Until the booking starts')).toBeInTheDocument()
  })

  it('offers the schedule tools to admins', async () => {
    const user = userEvent.setup()
    mockFetch(() => jsonResponse(detail))
    renderOverview('ADMIN')

    const tools = screen.getByRole('region', { name: 'Tools' })
    await user.click(within(tools).getByRole('button', { name: /Day templates/ }))

    expect(screen.getByTestId('location')).toHaveTextContent('/manage/day-templates')
  })

  it('is honest with roles CourtControl has no tools for yet', () => {
    mockFetch(() => jsonResponse(detail))
    renderOverview('GROUNDSKEEPER')

    const tools = screen.getByRole('region', { name: 'Tools' })
    expect(within(tools).queryByRole('button')).not.toBeInTheDocument()
    expect(
      within(tools).getByText(/Tools for groundskeeper aren’t available yet/),
    ).toBeInTheDocument()
  })

  it('explains a failure to load the club and retries', async () => {
    const user = userEvent.setup()
    let fail = true
    mockFetch(() => (fail ? new Response('', { status: 500 }) : jsonResponse(detail)))
    renderOverview()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "CourtControl couldn't load the club right now (500).",
    )
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Members only')).toBeInTheDocument()
  })
})
