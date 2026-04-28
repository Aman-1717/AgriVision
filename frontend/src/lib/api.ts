export type GetToken = () => Promise<string | null>

export async function apiFetch(
  input: string,
  init: RequestInit = {},
  getToken?: GetToken,
): Promise<Response> {
  const headers = new Headers(init.headers)
  if (getToken) {
    const t = await getToken()
    if (t) headers.set('Authorization', `Bearer ${t}`)
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  })
}

export async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>
}

/** Readable message from FastAPI { detail } / { message } / validation errors */
export function formatApiErrorBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const o = body as Record<string, unknown>
  if (typeof o.message === 'string' && o.message) return o.message
  if (typeof o.error === 'string' && o.error) return o.error
  if (typeof o.detail === 'string') return o.detail
  if (Array.isArray(o.detail)) {
    const parts = o.detail.map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'msg' in item)
        return String((item as { msg?: string }).msg ?? JSON.stringify(item))
      return JSON.stringify(item)
    })
    return parts.join(' ')
  }
  return fallback
}
