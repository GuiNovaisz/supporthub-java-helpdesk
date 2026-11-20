import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { SessionProvider, type Role } from '../auth/session'
import { App } from './App'
import { ThemeProvider } from './theme'

const fixture = {
  reference: 'SUP-0001',
  title: 'Acesso ao portal',
  description: 'O portal informa acesso negado.',
  status: 'OPEN',
  priority: 'MEDIUM',
  requesterId: 'customer-id',
  assignedAgentId: null,
  createdAt: '2026-11-10T10:00:00Z',
  updatedAt: '2026-11-10T10:00:00Z',
  closedAt: null,
  sla: {
    firstResponseDueAt: '2026-11-10T18:00:00Z',
    firstResponseAt: null,
    firstResponseStatus: 'PENDING',
    resolutionDueAt: '2026-11-12T10:00:00Z',
    resolvedAt: null,
    resolutionStatus: 'PENDING',
  },
}

function page(items: unknown[]) {
  return Response.json({
    items,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    page: 0,
    size: 20,
  })
}

function setup(path: string, handler: (path: string, options: RequestInit) => Response) {
  const fetcher = vi.fn((request: string, options: RequestInit) =>
    Promise.resolve(handler(request.replace('/api/v1', ''), options)),
  )
  vi.stubGlobal('fetch', fetcher)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <SessionProvider>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), fetcher }
}

function account(role: Role) {
  return Response.json({
    id: role.toLowerCase() + '-id',
    name: 'Pessoa de Teste',
    role,
    active: true,
  })
}

const csrf = () => Response.json({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })
const missing = () => new Response(null, { status: 404 })
afterEach(() => vi.unstubAllGlobals())

test('protected route redirects to login, then shows the server identity and logs out', async () => {
  let signedIn = false
  const { user } = setup('/tickets', (path) => {
    if (path === '/auth/me')
      return signedIn ? account('CUSTOMER') : new Response(null, { status: 401 })
    if (path === '/auth/csrf') return csrf()
    if (path === '/auth/login' || path === '/auth/logout') {
      signedIn = path === '/auth/login'
      return new Response(null, { status: 204 })
    }
    if (path.startsWith('/tickets?')) return page([])
    return missing()
  })
  await screen.findByRole('heading', { name: 'Entre no SupportHub' })
  await user.type(screen.getByLabelText('E-mail'), 'pessoa@example.test')
  await user.type(screen.getByLabelText('Senha'), 'synthetic')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(await screen.findByText('Pessoa de Teste')).toBeVisible()
  expect(await screen.findByText('Nenhum ticket encontrado')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Sair' }))
  expect(await screen.findByRole('heading', { name: 'Entre no SupportHub' })).toBeVisible()
})

test.each([
  ['CUSTOMER', '/queue'],
  ['CUSTOMER', '/users'],
  ['AGENT', '/users'],
] as const)('blocks %s from opening %s without fetching protected data', async (role, path) => {
  const { fetcher } = setup(path, (endpoint) =>
    endpoint === '/auth/me' ? account(role) : missing(),
  )
  expect(
    await screen.findByRole('heading', { name: 'Esta área não está disponível' }),
  ).toBeVisible()
  expect(fetcher.mock.calls.map(([request]) => request)).toEqual(['/api/v1/auth/me'])
})

test('validates the ticket form and sends only the customer-editable fields', async () => {
  const { user, fetcher } = setup('/tickets/new', (path, options) => {
    if (path === '/auth/me') return account('CUSTOMER')
    if (path === '/auth/csrf') return csrf()
    if (path === '/tickets' && options.method === 'POST')
      return Response.json(fixture, { status: 201 })
    if (path === '/tickets/SUP-0001') return Response.json(fixture)
    if (path.startsWith('/tickets/SUP-0001/comments')) return page([])
    return missing()
  })
  const submit = await screen.findByRole('button', { name: 'Criar ticket' })
  await user.click(submit)
  expect(await screen.findAllByText('Preencha este campo.')).toHaveLength(2)
  await user.type(screen.getByLabelText('Assunto'), fixture.title)
  await user.type(screen.getByLabelText('Descrição'), fixture.description)
  await user.click(submit)
  expect(await screen.findByRole('heading', { name: fixture.title })).toBeVisible()
  const write = fetcher.mock.calls.find(
    ([path, options]) => path === '/api/v1/tickets' && options.method === 'POST',
  )
  expect(JSON.parse(String(write?.[1].body))).toEqual({
    title: fixture.title,
    description: fixture.description,
  })
  expect(screen.queryByText('Nota interna')).not.toBeInTheDocument()
})

test('refreshes the assignee after losing claim without displaying false success', async () => {
  let claimLost = false
  const { user, fetcher } = setup('/queue/SUP-0001', (path) => {
    if (path === '/auth/me') return account('AGENT')
    if (path === '/auth/csrf') return csrf()
    if (path === '/agent/tickets/SUP-0001')
      return Response.json({ ...fixture, assignedAgentId: claimLost ? 'winning-agent-id' : null })
    if (path.startsWith('/agent/tickets/SUP-0001/comments')) return page([])
    if (path.endsWith('/claim')) {
      claimLost = true
      return new Response('technical server detail', { status: 409 })
    }
    return missing()
  })
  await user.click(await screen.findByRole('button', { name: 'Assumir ticket' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'A atribuição atual foi consultada novamente.',
  )
  expect(screen.getByTestId('assignee')).toHaveTextContent('winning-agent-id')
  expect(screen.queryByText('Você assumiu o ticket.')).not.toBeInTheDocument()
  expect(screen.queryByText('technical server detail')).not.toBeInTheDocument()
  expect(fetcher.mock.calls.filter(([path]) => path.endsWith('/claim'))).toHaveLength(1)
})

test('labels public replies and internal notes separately for staff', async () => {
  const { user } = setup('/queue/SUP-0001', (path) => {
    if (path === '/auth/me') return account('AGENT')
    if (path === '/agent/tickets/SUP-0001') return Response.json(fixture)
    if (path.startsWith('/agent/tickets/SUP-0001/comments'))
      return page([
        {
          id: '1',
          body: 'Verificação interna.',
          visibility: 'INTERNAL',
          authorId: 'agent-id',
          createdAt: fixture.createdAt,
        },
        {
          id: '2',
          body: 'Estamos verificando.',
          visibility: 'PUBLIC',
          authorId: 'agent-id',
          createdAt: fixture.createdAt,
        },
      ])
    return missing()
  })
  const list = await screen.findAllByRole('listitem')
  expect(within(list[0]).getByText('Nota interna')).toBeVisible()
  expect(within(list[1]).getByText('Comentário público')).toBeVisible()
  await user.click(screen.getByRole('radio', { name: 'Nota interna' }))
  expect(screen.getByText('Visível apenas à equipe de suporte.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Adicionar nota interna' })).toBeVisible()
})

test('moves through server pages using the pagination controls', async () => {
  const { user } = setup('/tickets', (path) => {
    if (path === '/auth/me') return account('CUSTOMER')
    if (!path.startsWith('/tickets?')) return missing()
    const pageIndex = Number(new URLSearchParams(path.split('?')[1]).get('page') ?? 0)
    return Response.json({
      items: [
        { ...fixture, title: pageIndex === 0 ? 'Primeiro ticket' : 'Ticket da próxima página' },
      ],
      totalElements: 11,
      totalPages: 2,
      page: pageIndex,
      size: 10,
    })
  })
  expect(await screen.findByText('Primeiro ticket')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Próxima página' }))
  expect(await screen.findByText('Ticket da próxima página')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
})
