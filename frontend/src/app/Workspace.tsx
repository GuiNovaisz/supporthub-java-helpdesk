import {
  ArrowUpRight,
  BriefcaseBusiness,
  CircleHelp,
  LogOut,
  Ticket,
  UsersRound,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { errorText } from '../api/client'
import { Brand, ThemeButton } from '../auth/AuthPage'
import { roleLabels, useAccount, useSession } from '../auth/session'
import { Notice } from '../shared/ui'

export function Workspace() {
  const account = useAccount()
  const { signOut } = useSession()
  const location = useLocation()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const customer = account.role === 'CUSTOMER'
  const area = location.pathname.startsWith('/users')
    ? 'Contas'
    : customer
      ? 'Meus tickets'
      : 'Fila de atendimento'
  const initials = account.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()

  async function logout() {
    setError('')
    setPending(true)
    try {
      await signOut()
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="workspace">
      <a href="#main" className="skip-link">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <div className="side-brand">
          <Brand />
        </div>
        <span className="nav-caption">ESPAÇO DE TRABALHO</span>
        <nav aria-label="Navegação principal" className="side-nav">
          <NavLink to={customer ? '/tickets' : '/queue'}>
            {customer ? (
              <Ticket size={19} aria-hidden="true" />
            ) : (
              <BriefcaseBusiness size={19} aria-hidden="true" />
            )}
            {customer ? 'Meus tickets' : 'Fila de atendimento'}
          </NavLink>
          {account.role === 'ADMIN' && (
            <NavLink to="/users">
              <UsersRound size={19} aria-hidden="true" /> Contas
            </NavLink>
          )}
        </nav>
        <div className="sidebar-foot">
          <span>
            <CircleHelp size={16} aria-hidden="true" /> Central de suporte
          </span>
          <span className="side-version">
            Full Stack Experience <ArrowUpRight size={13} aria-hidden="true" />
          </span>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <span className="breadcrumbs">
            Workspace <span aria-hidden="true">/</span> <strong>{area}</strong>
          </span>
          <div className="account-tools">
            <ThemeButton />
            <span className="account-avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="account-info">
              <strong>{account.name}</strong>
              <small>{roleLabels[account.role]}</small>
            </span>
            <button
              className="icon-button"
              onClick={() => void logout()}
              disabled={pending}
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={19} aria-hidden="true" />
            </button>
          </div>
        </header>
        <main className="workspace-main" id="main" tabIndex={-1}>
          {error && <Notice>{error}</Notice>}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
