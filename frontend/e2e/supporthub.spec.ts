import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

type Credentials = { email: string; password: string }
type Registration = Credentials & { name: string }
const api = '/api/v1'
const admin: Credentials = {
  email: process.env.ADMIN_EMAIL ?? 'admin@example.test',
  password: process.env.ADMIN_PASSWORD ?? '',
}

function person(name: string): Registration {
  return { name, email: randomUUID() + '@example.test', password: randomUUID() }
}

async function mutate(request: APIRequestContext, path: string, data?: unknown, method = 'POST') {
  const csrf = await request.get(api + '/auth/csrf')
  expect(csrf.status()).toBe(200)
  const { headerName, token } = await csrf.json()
  return request.fetch(api + path, { method, headers: { [headerName]: token }, data })
}

async function apiLogin(request: APIRequestContext, credentials: Credentials) {
  expect(
    (
      await mutate(request, '/auth/login', {
        email: credentials.email,
        password: credentials.password,
      })
    ).status(),
  ).toBe(204)
}

async function register(request: APIRequestContext, customer: Registration) {
  expect((await mutate(request, '/auth/register', customer)).status()).toBe(201)
  await apiLogin(request, customer)
}

async function createAgent(request: APIRequestContext, agent: Registration) {
  const response = await mutate(request, '/admin/users/agents', agent)
  expect(response.status()).toBe(201)
  return (await response.json()) as { id: string }
}

async function createTicket(request: APIRequestContext, title: string) {
  const response = await mutate(request, '/tickets', {
    title,
    description: 'O acesso ao serviço foi interrompido durante o expediente.',
  })
  expect(response.status()).toBe(201)
  return (await response.json()) as { reference: string; requesterId: string }
}

async function login(page: Page, user: Credentials) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
}

async function capture(page: Page, name: string) {
  const directory = process.env.SUPPORTHUB_GALLERY
  if (!directory) return
  await mkdir(directory, { recursive: true })
  await page.evaluate(async () => {
    await document.fonts.ready
    window.scrollTo(0, 0)
  })
  await page.screenshot({
    path: join(directory, name + '.png'),
    fullPage: true,
    animations: 'disabled',
  })
}

async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(
    result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
  ).toEqual([])
}

async function noOverflow(page: Page) {
  const bounds = await page.evaluate(() => ({
    actual: document.documentElement.scrollWidth,
    expected: window.innerWidth,
  }))
  expect(bounds.actual).toBeLessThanOrEqual(bounds.expected)
}

async function setStatus(page: Page, status: string) {
  await page.getByLabel('Próximo status').selectOption(status)
  await page.getByRole('button', { name: 'Salvar status' }).click()
  await expect(page.getByText('Status atualizado.')).toBeVisible()
}

test.beforeEach(() => {
  expect(!!admin.password, 'Set ADMIN_PASSWORD for the disposable Compose stack').toBe(true)
})

test('customer registration, ticket, conversation, ownership, protected routes and logout', async ({
  page,
  browser,
  baseURL,
}) => {
  const alice = person('Marina Costa')
  const policyErrors: string[] = []
  page.on('console', (message) => {
    if (/violates the following Content Security Policy/i.test(message.text()))
      policyErrors.push('CSP')
    if (/Error with Permissions-Policy header/i.test(message.text()))
      policyErrors.push('Permissions-Policy')
  })
  const response = await page.goto('/login')
  expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
  await expect(page.getByRole('heading', { name: 'Entre no SupportHub' })).toBeVisible()
  await accessible(page)
  await capture(page, '01-login')
  await page.getByRole('link', { name: 'Criar conta' }).click()
  await page.getByLabel('Nome completo').fill(alice.name)
  await page.getByLabel('E-mail').fill(alice.email)
  await page.getByLabel('Senha', { exact: true }).fill(alice.password)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('Conta criada. Entre para continuar.')).toBeVisible()
  await login(page, alice)
  await expect(page.getByText(alice.name)).toBeVisible()
  await createTicket(page.request, 'Ajuste de perfil no portal')
  await createTicket(page.request, 'Orientação para configurar o acesso')
  const session = (await page.context().cookies()).find((cookie) => cookie.name === 'JSESSIONID')
  expect(session?.httpOnly).toBe(true)
  expect(session?.sameSite).toBe('Lax')

  await page.getByRole('link', { name: 'Novo ticket' }).click()
  await expect(page.getByRole('heading', { name: 'Novo ticket' })).toBeVisible()
  await capture(page, '03-novo-ticket')
  const title = 'Acesso ao portal financeiro'
  await page.getByLabel('Assunto').fill(title)
  await page
    .getByLabel('Descrição')
    .fill('O portal apresenta uma mensagem de acesso negado desde a manhã.')
  await page.getByRole('button', { name: 'Criar ticket' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const path = new URL(page.url()).pathname
  const reference = path.split('/').at(-1)!
  await expect(page.getByText('Aberto', { exact: true })).toBeVisible()
  await expect(page.getByText('Média', { exact: true })).toBeVisible()
  await page.getByLabel('Escreva um comentário').fill('O problema ainda acontece em outra estação.')
  await page.getByRole('button', { name: 'Enviar comentário' }).click()
  await expect(page.getByText('O problema ainda acontece em outra estação.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Linha do tempo' })).toBeVisible()
  await accessible(page)
  await capture(page, '04-ticket-cliente')
  expect(
    (
      await page.request.post(api + '/tickets/' + reference + '/comments', {
        data: { body: 'Sem CSRF', visibility: 'PUBLIC' },
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await mutate(page.request, '/tickets/' + reference + '/comments', {
        body: 'Nota proibida',
        visibility: 'INTERNAL',
      })
    ).status(),
  ).toBe(403)
  await page.goto('/tickets')
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Ir para o conteúdo' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await capture(page, '02-meus-tickets')
  for (const forbidden of ['/queue', '/users']) {
    await page.goto(forbidden)
    await expect(page.getByRole('heading', { name: 'Esta área não está disponível' })).toBeVisible()
  }
  expect((await page.request.get(api + '/agent/tickets')).status()).toBe(403)
  expect((await page.request.get(api + '/admin/users')).status()).toBe(403)

  const other = await browser.newContext({ baseURL })
  try {
    await register(other.request, person('Caio Lima'))
    const otherPage = await other.newPage()
    await otherPage.goto(path)
    await expect(otherPage.getByRole('alert')).toContainText(
      'Este recurso não está disponível para sua conta.',
    )
    await expect(otherPage.getByRole('heading', { name: title })).toHaveCount(0)
    expect((await other.request.get(api + '/tickets/' + reference)).status()).toBe(404)
  } finally {
    await other.close()
  }

  await page.goto(path)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await noOverflow(page)
  await accessible(page)
  await capture(page, '10-mobile-ticket')
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Entre no SupportHub' })).toBeVisible()
  expect((await page.request.get(api + '/auth/me')).status()).toBe(401)
  expect(policyErrors).toEqual([])
  expect(
    await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    })),
  ).toEqual({
    local: ['supporthub-theme'],
    session: [],
  })
})

test('agent operates a ticket, public reply records SLA and internal note stays private', async ({
  page,
  browser,
  baseURL,
}) => {
  const provision = await browser.newContext({ baseURL })
  const customer = await browser.newContext({ baseURL })
  try {
    await apiLogin(provision.request, admin)
    const agent = person('Rafael Almeida')
    await createAgent(provision.request, agent)
    await register(customer.request, person('Helena Nunes'))
    const title = 'Falha no painel de relatórios'
    const { reference } = await createTicket(customer.request, title)
    await login(page, agent)
    await expect(page.getByRole('heading', { name: 'Fila de atendimento' })).toBeVisible()
    await page.getByText('Filtros operacionais', { exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Atribuição', exact: true })
      .selectOption({ label: 'Sem responsável' })
    await page.getByRole('button', { name: 'Aplicar filtros operacionais' }).click()
    await expect(page).toHaveURL(/assigned=false/)
    const ticketLink = page.getByRole('link', { name: new RegExp(title) })
    await expect(ticketLink).toBeVisible()
    await accessible(page)
    await capture(page, '05-fila-agente')
    await page.setViewportSize({ width: 820, height: 1180 })
    await noOverflow(page)
    await capture(page, '09-tablet-fila')
    await page.setViewportSize({ width: 1440, height: 960 })
    await ticketLink.click()
    await page.getByRole('button', { name: 'Assumir ticket' }).click()
    await expect(page.getByTestId('assignee')).toHaveText('Você')
    await setStatus(page, 'IN_PROGRESS')
    await page.getByLabel('Prioridade operacional').selectOption('HIGH')
    await page.getByRole('button', { name: 'Salvar prioridade' }).click()
    await expect(page.getByText('Prioridade atualizada.')).toBeVisible()
    await page
      .getByLabel('Escreva um comentário')
      .fill('Estamos verificando seu acesso aos relatórios.')
    await page.getByRole('button', { name: 'Enviar comentário' }).click()
    await expect(page.getByText('Estamos verificando seu acesso aos relatórios.')).toBeVisible()
    await page.getByRole('radio', { name: 'Nota interna' }).check()
    await page
      .getByLabel('Escreva uma nota interna')
      .fill('Conferir permissões do grupo de relatórios.')
    await page.getByRole('button', { name: 'Adicionar nota interna' }).click()
    await expect(page.getByText('Conferir permissões do grupo de relatórios.')).toBeVisible()
    await expect(page.getByText('No prazo', { exact: true })).toBeVisible()
    await accessible(page)
    await capture(page, '06-workspace-agente')
    await page.getByRole('button', { name: 'Ativar tema escuro' }).click()
    await page.setViewportSize({ width: 1280, height: 900 })
    await noOverflow(page)
    await accessible(page)
    await capture(page, '07-workspace-escuro')
    await setStatus(page, 'RESOLVED')
    await page.getByRole('button', { name: 'Histórico', exact: true }).click()
    await expect(page.getByText('Ticket resolvido', { exact: true })).toBeVisible()
    await expect(page.getByText('Nota interna adicionada', { exact: true })).toBeVisible()
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'Esta área não está disponível' })).toBeVisible()
    expect((await page.request.get(api + '/admin/users')).status()).toBe(403)
    const customerPage = await customer.newPage()
    await customerPage.goto('/tickets/' + reference)
    await expect(
      customerPage.getByText('Estamos verificando seu acesso aos relatórios.'),
    ).toBeVisible()
    await expect(customerPage.getByText('Conferir permissões do grupo de relatórios.')).toHaveCount(
      0,
    )
    await expect(customerPage.getByText('Nota interna')).toHaveCount(0)
    await customerPage.getByRole('button', { name: 'Reabrir ticket' }).click()
    await expect(customerPage.getByText('Em atendimento', { exact: true })).toBeVisible()
    await expect(customerPage.getByText('Primeira resposta pública', { exact: true })).toBeVisible()
  } finally {
    await customer.close()
    await provision.close()
  }
})

test('admin provisions an agent, manages accounts and assigns, reassigns and unassigns a ticket', async ({
  page,
  browser,
  baseURL,
}) => {
  const customer = await browser.newContext({ baseURL })
  try {
    const client = person('Beatriz Souza')
    await register(customer.request, client)
    const { reference } = await createTicket(customer.request, 'Ajuste de perfil de acesso')
    await login(page, admin)
    const second = person('Diego Martins')
    const secondAccount = await createAgent(page.request, second)
    const first = person('Joana Ribeiro')
    await page.getByRole('link', { name: 'Contas', exact: true }).click()
    await page.getByRole('button', { name: 'Novo agente' }).click()
    await page.getByLabel('Nome completo').fill(first.name)
    await page.getByLabel('E-mail').fill(first.email)
    await page.getByLabel('Senha inicial').fill(first.password)
    await page.getByRole('button', { name: 'Criar agente' }).click()
    await expect(page.getByText('Conta de agente criada.')).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: first.name })).toBeVisible()
    await accessible(page)
    await capture(page, '08-administracao')
    await page.getByRole('button', { name: 'Desativar conta de ' + client.name }).click()
    const confirmation = page.getByRole('dialog', { name: 'Desativar conta?' })
    await expect(confirmation).toBeVisible()
    await accessible(page)
    await confirmation.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByText('Conta desativada.')).toBeVisible()
    expect((await customer.request.get(api + '/auth/me')).status()).toBe(401)
    await page.getByRole('button', { name: 'Ativar conta de ' + client.name }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByText('Conta ativada.')).toBeVisible()
    await page.goto('/queue/' + reference)
    await page.getByLabel('Agente responsável').selectOption({ label: first.name })
    await page.getByRole('button', { name: 'Atribuir', exact: true }).click()
    await expect(page.getByText('Atribuição atualizada.')).toBeVisible()
    await expect(page.getByTestId('assignee')).not.toHaveText('Sem responsável')
    await page.getByLabel('Agente responsável').selectOption({ label: second.name })
    await page.getByRole('button', { name: 'Reatribuir', exact: true }).click()
    await expect(page.getByTestId('assignee')).toHaveText(secondAccount.id)
    await page.getByRole('button', { name: 'Remover atribuição' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByTestId('assignee')).toHaveText('Sem responsável')
    await page.getByRole('button', { name: 'Histórico', exact: true }).click()
    for (const event of ['Agente atribuído', 'Agente reatribuído', 'Atribuição removida']) {
      await expect(page.getByRole('list').getByText(event, { exact: true })).toBeVisible()
    }
  } finally {
    await customer.close()
  }
})

test('agent losing a real claim receives 409, refreshes the assignee and sees one audit event', async ({
  page,
  browser,
  baseURL,
}) => {
  const provision = await browser.newContext({ baseURL })
  const winner = await browser.newContext({ baseURL })
  const customer = await browser.newContext({ baseURL })
  try {
    await apiLogin(provision.request, admin)
    const first = person('Agente vencedor')
    const second = person('Agente concorrente')
    const winnerAccount = await createAgent(provision.request, first)
    await createAgent(provision.request, second)
    await apiLogin(winner.request, first)
    await register(customer.request, person('Cliente da disputa'))
    const { reference } = await createTicket(customer.request, 'Solicitação em disputa')
    await login(page, second)
    await page.goto('/queue/' + reference)
    const claim = page.getByRole('button', { name: 'Assumir ticket' })
    await expect(claim).toBeVisible()
    expect((await mutate(winner.request, '/agent/tickets/' + reference + '/claim')).status()).toBe(
      200,
    )
    const conflict = page.waitForResponse(
      (response) => response.url().endsWith('/claim') && response.request().method() === 'POST',
    )
    await claim.click()
    expect((await conflict).status()).toBe(409)
    await expect(page.getByRole('alert')).toContainText(
      'A atribuição atual foi consultada novamente.',
    )
    await expect(page.getByTestId('assignee')).toHaveText(winnerAccount.id)
    await expect(page.getByText('Você assumiu o ticket.')).toHaveCount(0)
    const history = await winner.request.get(api + '/agent/tickets/' + reference + '/history')
    expect(history.status()).toBe(200)
    const assigned = (await history.json()).items.filter(
      (event: { type: string }) => event.type === 'ASSIGNED',
    )
    expect(assigned).toHaveLength(1)
    expect(assigned[0].newValue).toBe(winnerAccount.id)
  } finally {
    await customer.close()
    await winner.close()
    await provision.close()
  }
})
