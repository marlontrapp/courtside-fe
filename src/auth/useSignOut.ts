import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { logout } from '@/api/auth'
import { AUTH_QUERY_KEY, useAuth } from '@/auth/auth-context'

/** Sign out, forget the previous user's cached data, and go to the sign-in page. */
export function useSignOut({ onSignedOut }: { onSignedOut?: () => void } = {}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refresh } = useAuth()

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      onSignedOut?.()
      await refresh()
      // Their bookings, clubs, … must not show to whoever signs in next.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== AUTH_QUERY_KEY[0],
      })
      navigate('/login', { replace: true })
    },
  })
}
