export class ApiError extends Error {
  constructor(public readonly status: number) {
    super('A solicitação não pôde ser concluída.')
  }
}

export const sessionEvents = new EventTarget()

async function checkedFetch(path: string, options: RequestInit = {}) {
  const response = await fetch('/api/v1' + path, {
    ...options,
    credentials: 'include',
    cache: 'no-store',
  })
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/me' && path !== '/auth/login') {
      sessionEvents.dispatchEvent(new Event('expired'))
    }
    if (response.status === 403) {
      sessionEvents.dispatchEvent(new Event('revalidate'))
    }
    throw new ApiError(response.status)
  }
  return response
}

export async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await checkedFetch(path, { signal })).json()
}

export async function write<T = void>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<T> {
  // Each mutation obtains a token for the current cookie. Never replay a write on failure.
  const { headerName, token } = await read<{ headerName: string; token: string }>('/auth/csrf')
  const headers = new Headers({ [headerName]: token })
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const response = await checkedFetch(path, { method, headers, body: JSON.stringify(body) })
  return response.status === 204 ? (undefined as T) : response.json()
}

export function errorText(error: unknown, conflict?: string) {
  if (!(error instanceof ApiError)) return 'Não foi possível conectar. Tente novamente.'
  switch (error.status) {
    case 400:
    case 422:
      return 'Revise os dados informados e tente novamente.'
    case 401:
      return 'Sessão encerrada ou credenciais inválidas.'
    case 403:
      return 'A ação não foi autorizada. Atualize a página se sua sessão mudou.'
    case 404:
      return 'Este recurso não está disponível para sua conta.'
    case 409:
      return conflict ?? 'Os dados já existem ou mudaram. Atualize e tente novamente.'
    default:
      return 'Não foi possível concluir a ação. Tente novamente.'
  }
}

export interface Page<T> {
  items: T[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}
