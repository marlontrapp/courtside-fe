const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** Ensure Django has issued a csrftoken cookie before mutating requests. */
export async function ensureCsrfCookie(): Promise<string> {
  const existing = getCookie('csrftoken')
  if (existing) return existing

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api-auth/login/`, {
      method: 'GET',
      credentials: 'include',
    })
  } catch {
    throw new ApiError(
      'CourtControl is unreachable. Start the API (make run) and check VITE_API_PROXY_TARGET.',
      0,
    )
  }

  if (!response.ok) {
    throw new ApiError(
      `CourtControl login endpoint returned ${response.status}. Is CourtControl running on the proxy target (not another app on :8000)?`,
      response.status,
    )
  }

  const token = getCookie('csrftoken')
  if (!token) {
    throw new ApiError(
      'CourtControl responded but did not set a csrftoken cookie. Check CSRF/cookie settings.',
      0,
    )
  }
  return token
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown> | null
  json?: boolean
}

export async function apiRequest(
  path: string,
  { body, json = true, headers, ...init }: RequestOptions = {},
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const needsCsrf = !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)
  const requestHeaders = new Headers(headers)

  if (needsCsrf) {
    const csrfToken = await ensureCsrfCookie()
    requestHeaders.set('X-CSRFToken', csrfToken)
  }

  let payload: BodyInit | undefined
  if (body != null && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams) && !(body instanceof Blob)) {
    if (json) {
      requestHeaders.set('Content-Type', 'application/json')
      payload = JSON.stringify(body)
    } else {
      payload = body as BodyInit
    }
  } else if (body != null) {
    payload = body as BodyInit
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    method,
    headers: requestHeaders,
    credentials: 'include',
    body: payload,
  })
}

export async function apiJson<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await apiRequest(path, options)
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const data = (await response.json()) as { detail?: string }
      if (data.detail) message = data.detail
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
