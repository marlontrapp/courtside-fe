import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'

export function RequireAuth() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ink text-mist">
        Checking session…
      </main>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
