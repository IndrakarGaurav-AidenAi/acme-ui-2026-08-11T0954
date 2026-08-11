// Thin fetch() wrapper shared by every services/*.ts module — attaches the bearer token (read by
// the caller from AppStore.authToken() and passed in explicitly) and normalizes error handling.
// Plain functions, not an injectable class: every caller already has the token in hand (store.ts
// holds it directly; components read it via `this.store.authToken()`), so there's nothing DI would
// buy here — and it sidesteps a circular dependency between AppStore and an ApiClient service.

import { environment } from '../../environments/environment'

// In dev, apiBaseUrl is '' so paths stay relative and go through proxy.conf.json. In prod,
// apiBaseUrl points at the backend directly since there's no reverse proxy in front of it.
function resolve(path: string): string {
  return environment.apiBaseUrl + path
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

function headers(token: string | null, hasBody: boolean): HeadersInit {
  const h: Record<string, string> = {}
  if (token) h['Authorization'] = 'Bearer ' + token
  if (hasBody) h['Content-Type'] = 'application/json'
  return h
}

async function unwrap<T>(res: Response): Promise<T> {
  // Read as text first, not .json() directly — a bare-`void` Spring MVC handler (most DELETEs in
  // this backend) returns 200 with an EMPTY body, not 204, and .json() throws a SyntaxError on an
  // empty string. Covers 204 too, so no separate status check is needed.
  const text = await res.text()
  let body: unknown = null
  if (text) { try { body = JSON.parse(text) } catch { /* non-JSON body (e.g. a proxy error page) */ } }
  if (!res.ok) {
    throw new ApiError(res.status, (body as { message?: string } | null)?.message ?? `Request failed (${res.status})`)
  }
  return body as T
}

// Raw fetch with just the Authorization header attached — for blob/multipart calls where apiGet's
// JSON-only assumption (and apiPost's forced Content-Type: application/json) don't fit.
export function apiFetch(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  const h: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) }
  if (token) h['Authorization'] = 'Bearer ' + token
  return fetch(resolve(path), { ...init, headers: h })
}

export function apiGet<T>(path: string, token: string | null): Promise<T> {
  return fetch(resolve(path), { headers: headers(token, false) }).then((r) => unwrap<T>(r))
}

export function apiPost<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  return fetch(resolve(path), {
    method: 'POST',
    headers: headers(token, body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => unwrap<T>(r))
}

export function apiPatch<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  return fetch(resolve(path), {
    method: 'PATCH',
    headers: headers(token, body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => unwrap<T>(r))
}

export function apiPut<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  return fetch(resolve(path), {
    method: 'PUT',
    headers: headers(token, body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => unwrap<T>(r))
}

export function apiDelete<T>(path: string, token: string | null): Promise<T> {
  return fetch(resolve(path), { method: 'DELETE', headers: headers(token, false) }).then((r) => unwrap<T>(r))
}
