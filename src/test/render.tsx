import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { AuthContext, type AuthContextValue } from '@/auth/auth-context'
import { makeMe } from '@/test/factories'
import {
  WorkspaceContext,
  type WorkspaceContextValue,
} from '@/workspace/workspace-context'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity },
    },
  })
}

/** Render inside the providers pages expect, with a signed-in auth context. */
export function renderWithProviders(
  ui: ReactElement,
  {
    auth,
    route = '/',
    workspace,
  }: {
    auth?: Partial<AuthContextValue>
    route?: string
    /** Provide a workspace (club pages need one). */
    workspace?: Partial<WorkspaceContextValue>
  } = {},
) {
  const queryClient = createTestQueryClient()
  const authValue: AuthContextValue = {
    status: 'authenticated',
    user: makeMe(),
    refresh: vi.fn(async () => {}),
    ...auth,
  }

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <WorkspaceContext.Provider
          value={{
            workspace: null,
            club: null,
            role: null,
            setWorkspace: vi.fn(),
            ...workspace,
          }}
        >
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </WorkspaceContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  return { ...result, queryClient, auth: authValue }
}

/** Current router search params, as rendered by `LocationProbe`. */
export function currentSearch(getByTestId: (id: string) => HTMLElement): URLSearchParams {
  const text = getByTestId('location').textContent ?? ''
  return new URLSearchParams(text.split('?')[1] ?? '')
}

/**
 * Freeze `Date` only (timers stay real, so Testing Library and user-event work).
 * Defaults to noon in São Paulo on the fixture day used by `makeCourt`.
 */
export function freezeDate(iso = '2030-01-08T12:00:00-03:00') {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}
