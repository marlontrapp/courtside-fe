import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, type ReactNode } from 'react'

import { fetchMe } from '@/api/me'
import { AUTH_QUERY_KEY, AuthContext, type AuthStatus } from '@/auth/auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const sessionQuery = useQuery({
    queryKey: AUTH_QUERY_KEY,
    // GET /api/v1/me/ doubles as the session probe: null = signed out.
    queryFn: fetchMe,
    staleTime: 60_000,
  })

  const status: AuthStatus = sessionQuery.isPending
    ? 'loading'
    : sessionQuery.data
      ? 'authenticated'
      : 'anonymous'

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
  }, [queryClient])

  const user = sessionQuery.data ?? null
  const value = useMemo(() => ({ status, user, refresh }), [status, user, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
