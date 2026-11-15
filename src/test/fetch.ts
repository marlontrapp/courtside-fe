import { vi } from 'vitest'

export type FetchHandler = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** Replace global fetch; the handler gets the parsed request URL. Unstubbed after each test. */
export function mockFetch(handler: FetchHandler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = input instanceof Request ? input.url : String(input)
    return handler(new URL(raw, 'http://localhost'), init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Requested paths + query strings, e.g. `/api/v1/courts/?page=2`. */
export function requestedUrls(fetchMock: ReturnType<typeof mockFetch>): string[] {
  return fetchMock.mock.calls.map(([input]) => {
    const url = new URL(String(input), 'http://localhost')
    return `${url.pathname}${url.search}`
  })
}
