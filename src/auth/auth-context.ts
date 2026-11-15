import { createContext, useContext } from 'react'

import type { Me } from '@/api/me'

export const AUTH_QUERY_KEY = ['auth', 'session'] as const

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export type AuthContextValue = {
  status: AuthStatus
  /** The signed-in user (null while loading or signed out). */
  user: Me | null
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
