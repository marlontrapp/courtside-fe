import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, type ReactNode } from 'react'

import { isAuthenticated } from '@/api/auth'
import { AUTH_QUERY_KEY, AuthContext, type AuthStatus } from '@/auth/auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const sessionQuery = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: isAuthenticated,
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

  const value = useMemo(() => ({ status, refresh }), [status, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
