import { afterEach, expect, test, vi } from 'vitest'
import { write } from './client'

afterEach(() => vi.unstubAllGlobals())

test('gets a fresh CSRF token and sends it with the current session on every write', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ headerName: 'X-CSRF-TOKEN', token: 'first' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(Response.json({ headerName: 'X-CSRF-TOKEN', token: 'second' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetcher)
  await write('/auth/login', 'POST', { email: 'tester@example.test', password: 'synthetic' })
  await write('/auth/logout', 'POST')
  expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/auth/csrf',
    '/api/v1/auth/login',
    '/api/v1/auth/csrf',
    '/api/v1/auth/logout',
  ])
  expect(fetcher.mock.calls[1][1].headers.get('X-CSRF-TOKEN')).toBe('first')
  expect(fetcher.mock.calls[3][1].headers.get('X-CSRF-TOKEN')).toBe('second')
  expect(fetcher.mock.calls.every(([, options]) => options.credentials === 'include')).toBe(true)
})

test('reports a server conflict without replaying a mutation', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ headerName: 'X-CSRF-TOKEN', token: 'test' }))
    .mockResolvedValueOnce(new Response('internal diagnostics', { status: 409 }))
  vi.stubGlobal('fetch', fetcher)
  await expect(write('/agent/tickets/SUP-0001/claim', 'POST')).rejects.toMatchObject({
    status: 409,
  })
  expect(fetcher).toHaveBeenCalledTimes(2)
})
