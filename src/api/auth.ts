import { ApiError, apiRequest, ensureCsrfCookie } from '@/api/client'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export type LoginCredentials = {
  email: string
  password: string
}

/**
 * CourtControl uses Django session auth via DRF's browsable login form.
 * Field name is `username`, but the value is the user's email.
 */
export async function login({ email, password }: LoginCredentials): Promise<void> {
  const csrfToken = await ensureCsrfCookie()
  const body = new URLSearchParams({
    username: email,
    password,
    csrfmiddlewaretoken: csrfToken,
    next: '/',
  })

  const response = await fetch(`${API_BASE_URL}/api-auth/login/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRFToken': csrfToken,
    },
    body,
    redirect: 'manual',
  })

  // DRF login redirects on success; 200 with the form means bad credentials.
  const redirected =
    response.type === 'opaqueredirect' ||
    (response.status >= 300 && response.status < 400)

  if (redirected) return

  if (response.status === 200) {
    throw new ApiError('Invalid email or password.', 400)
  }

  throw new ApiError(`Login failed (${response.status}).`, response.status)
}

export async function logout(): Promise<void> {
  const response = await apiRequest('/api-auth/logout/', {
    method: 'POST',
    body: new URLSearchParams(),
    json: false,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'manual',
  })

  const redirected =
    response.type === 'opaqueredirect' ||
    (response.status >= 300 && response.status < 400) ||
    response.ok

  if (!redirected) {
    throw new ApiError(`Logout failed (${response.status}).`, response.status)
  }
}

/** Probe session by hitting a protected endpoint. */
export async function isAuthenticated(): Promise<boolean> {
  const response = await apiRequest('/api/v1/courts/')
  return response.ok
}
