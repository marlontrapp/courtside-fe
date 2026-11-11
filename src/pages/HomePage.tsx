import { useMutation } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'

import { logout } from '@/api/auth'
import { useAuth } from '@/auth/auth-context'

export function HomePage() {
  const navigate = useNavigate()
  const { status, refresh } = useAuth()

  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await refresh()
      navigate('/login', { replace: true })
    },
  })

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  if (status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ink text-mist">
        Checking session…
      </main>
    )
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-ink text-line">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(31,122,85,0.35),transparent_55%),linear-gradient(180deg,#07150f,#0c3b2a)]"
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-medium tracking-[0.28em] text-ball uppercase">
          CourtControl
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">You&apos;re in.</h1>
        <p className="mt-4 max-w-lg text-mist">
          The rest of the app lands here next — clubs, courts, and bookings against the
          CourtControl API.
        </p>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mt-10 w-fit border border-line/30 px-4 py-2.5 text-sm font-medium tracking-wide text-line uppercase transition hover:border-ball hover:text-ball disabled:opacity-60"
        >
          {mutation.isPending ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </main>
  )
}
