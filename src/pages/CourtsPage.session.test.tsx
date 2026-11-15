import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { CourtsPage } from '@/pages/CourtsPage'
import { makeCourt, makePage } from '@/test/factories'
import { jsonResponse, mockFetch } from '@/test/fetch'
import { createTestQueryClient } from '@/test/render'

/** Same guard as App.tsx, with a stub login screen. */
function renderApp() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/courts']}>
          <Routes>
            <Route path="/login" element={<h1>Sign in</h1>} />
            <Route element={<RequireAuth />}>
              <Route path="/courts" element={<CourtsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('CourtsPage session handling', () => {
  it('renders courts for a signed-in user', async () => {
    mockFetch(() => jsonResponse(makePage([makeCourt({ name: 'Court 1 - Guga' })])))

    renderApp()

    expect(
      await screen.findByRole('article', { name: 'Court 1 - Guga' }),
    ).toBeInTheDocument()
  })

  it('sends the user to sign in when the session expires', async () => {
    let calls = 0
    mockFetch(() =>
      // 1st call: the session probe succeeds; afterwards the session is gone.
      ++calls === 1
        ? jsonResponse(makePage([]))
        : jsonResponse({ detail: 'Authentication credentials were not provided.' }, 403),
    )

    renderApp()

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Find a court' }),
    ).not.toBeInTheDocument()
  })
})
