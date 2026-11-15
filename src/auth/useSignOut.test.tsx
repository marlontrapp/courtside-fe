import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AUTH_QUERY_KEY } from '@/auth/auth-context'
import { useSignOut } from '@/auth/useSignOut'
import { UPCOMING_RESERVATIONS_QUERY_KEY } from '@/api/reservations'
import { mockFetch } from '@/test/fetch'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/render'

function SignOutButton() {
  const signOut = useSignOut()
  return (
    <button type="button" onClick={() => signOut.mutate()}>
      Sign out
    </button>
  )
}

describe('useSignOut', () => {
  it("signs out, forgets the previous user's data, and goes to sign in", async () => {
    const user = userEvent.setup()
    document.cookie = 'csrftoken=test-csrf-token'
    const fetchMock = mockFetch(() => new Response(null, { status: 200 }))
    const { queryClient, auth } = renderWithProviders(
      <>
        <SignOutButton />
        <LocationProbe />
      </>,
      { route: '/bookings' },
    )
    queryClient.setQueryData(UPCOMING_RESERVATIONS_QUERY_KEY, {
      pages: [],
      pageParams: [],
    })
    queryClient.setQueryData(AUTH_QUERY_KEY, null)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/login'),
    )
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api-auth/logout/')
    expect(auth.refresh).toHaveBeenCalled()
    // Their bookings must not show to whoever signs in next…
    expect(queryClient.getQueryData(UPCOMING_RESERVATIONS_QUERY_KEY)).toBeUndefined()
    // …while the session query stays (it's what says "signed out").
    expect(queryClient.getQueryState(AUTH_QUERY_KEY)).toBeDefined()
  })
})
