import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { UsersPage } from '../users/UsersPage'
import { AuthPage } from '../auth/AuthPage'
import { landing, useSession, type Role } from '../auth/session'
import { Loading, QueryError } from '../shared/ui'
import { CreateTicket } from '../tickets/CreateTicket'
import { TicketDetail } from '../tickets/TicketDetail'
import { TicketList } from '../tickets/TicketList'
import { Workspace } from './Workspace'

export function AccessGate({ roles }: { roles?: Role[] }) {
  const { query } = useSession()
  if (query.isPending)
    return (
      <main>
        <Loading />
      </main>
    )
  if (query.isError)
    return (
      <main className="standalone">
        <QueryError error={query.error} retry={() => void query.refetch()} />
      </main>
    )
  if (!query.data) return <Navigate to="/login" replace />
  if (roles && !roles.includes(query.data.role)) {
    return (
      <section className="panel restricted">
        <span className="eyebrow">ACESSO RESTRITO</span>
        <h1>Esta área não está disponível</h1>
        <p className="muted">Sua conta não possui acesso a esta página.</p>
        <Link className="button secondary" to={landing(query.data.role)}>
          Voltar ao meu espaço
        </Link>
      </section>
    )
  }
  return <Outlet />
}

function PublicGate() {
  const { query } = useSession()
  if (query.isPending)
    return (
      <main>
        <Loading />
      </main>
    )
  return query.data ? <Navigate to={landing(query.data.role)} replace /> : <Outlet />
}

function Home() {
  const { query } = useSession()
  if (query.isPending) return <Loading />
  return <Navigate to={query.data ? landing(query.data.role) : '/login'} replace />
}

export function App() {
  return (
    <Routes>
      <Route element={<PublicGate />}>
        <Route path="/login" element={<AuthPage key="login" />} />
        <Route path="/register" element={<AuthPage key="register" registration />} />
      </Route>
      <Route element={<AccessGate />}>
        <Route element={<Workspace />}>
          <Route element={<AccessGate roles={['CUSTOMER']} />}>
            <Route path="/tickets" element={<TicketList key="customer" />} />
            <Route path="/tickets/new" element={<CreateTicket />} />
            <Route path="/tickets/:reference" element={<TicketDetail key="customer" />} />
          </Route>
          <Route element={<AccessGate roles={['AGENT', 'ADMIN']} />}>
            <Route path="/queue" element={<TicketList key="staff" />} />
            <Route path="/queue/:reference" element={<TicketDetail key="staff" />} />
          </Route>
          <Route element={<AccessGate roles={['ADMIN']} />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
