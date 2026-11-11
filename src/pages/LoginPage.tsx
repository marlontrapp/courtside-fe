import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { ApiError } from '@/api/client'
import { login } from '@/api/auth'
import { useAuth } from '@/auth/auth-context'

const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const { status, refresh } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async () => {
      await refresh()
      navigate('/', { replace: true })
    },
  })

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(values)
  })

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'Something went wrong. Try again.'
        : null

  return (
    <main className="relative min-h-dvh overflow-hidden bg-ink text-line">
      <div
        aria-hidden
        className="fade-in absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(31,122,85,0.45),transparent_55%),radial-gradient(ellipse_at_80%_10%,rgba(200,245,66,0.12),transparent_40%),linear-gradient(160deg,#07150f_0%,#0c3b2a_48%,#07150f_100%)]"
      />
      <div aria-hidden className="court-grid absolute inset-0 opacity-40" />
      <div
        aria-hidden
        className="pulse-line absolute left-[12%] top-[18%] h-[64%] w-px bg-gradient-to-b from-transparent via-line/70 to-transparent"
      />
      <div
        aria-hidden
        className="pulse-line absolute left-[12%] right-[18%] top-[50%] h-px bg-gradient-to-r from-transparent via-ball/70 to-transparent [animation-delay:400ms]"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
        <div className="fade-up max-w-xl">
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-line sm:text-6xl lg:text-7xl">
            Courtside
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-mist sm:text-lg">
            Sign in to book courts, manage clubs, and keep your schedule on the line.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="fade-up mt-12 w-full max-w-md space-y-5 [animation-delay:120ms]"
          noValidate
        >
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-mist">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full border border-line/20 bg-ink/40 px-4 py-3 text-line outline-none transition placeholder:text-fog focus:border-ball/70 focus:ring-2 focus:ring-ball/30"
              placeholder="you@club.example"
              {...register('email')}
            />
            {errors.email ? (
              <p className="text-sm text-clay">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-mist">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full border border-line/20 bg-ink/40 px-4 py-3 text-line outline-none transition placeholder:text-fog focus:border-ball/70 focus:ring-2 focus:ring-ball/30"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password ? (
              <p className="text-sm text-clay">{errors.password.message}</p>
            ) : null}
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-mist"
            >
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={mutation.isPending || status === 'loading'}
            className="group relative w-full overflow-hidden bg-ball px-4 py-3.5 text-sm font-semibold tracking-wide text-ink uppercase transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="relative z-10">
              {mutation.isPending ? 'Signing in…' : 'Sign in'}
            </span>
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-0 bg-white/25 transition-all duration-500 group-hover:w-full"
            />
          </button>
        </form>
      </div>
    </main>
  )
}
