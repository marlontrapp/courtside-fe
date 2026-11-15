import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { login } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { CourtBackdrop } from '@/layout/CourtBackdrop'

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
      // Ask how they want to act this time (player, club admin, …).
      navigate('/start', { replace: true })
    },
  })

  if (status === 'authenticated') {
    return <Navigate to="/start" replace />
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
      <CourtBackdrop />

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
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@club.example"
            error={errors.email?.message}
            {...register('email')}
          />

          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          {errorMessage ? <Alert>{errorMessage}</Alert> : null}

          <Button
            type="submit"
            fullWidth
            className="py-3.5"
            disabled={mutation.isPending || status === 'loading'}
          >
            {mutation.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  )
}
