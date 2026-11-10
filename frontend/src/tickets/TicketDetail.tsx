import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Ticket as TicketIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { read } from '../api/client'
import { useAccount } from '../auth/session'
import { Conversation } from '../comments/Conversation'
import { dateTime, Loading, Notice, QueryError } from '../shared/ui'
import { SlaPanel } from '../sla/SlaPanel'
import { PriorityBadge, StatusBadge } from './Badges'
import { CustomerTimeline, StaffHistory } from './History'
import { ticketApi, ticketKeys, ticketPath, type TicketDetails } from './model'
import { TicketOperations } from './TicketOperations'

function TicketWorkspace({ reference }: { reference: string }) {
  const account = useAccount()
  const { state } = useLocation()
  const [panel, setPanel] = useState<'conversation' | 'history'>('conversation')
  const customer = account.role === 'CUSTOMER'
  const path = ticketApi(account.role) + '/' + encodeURIComponent(reference)
  const query = useQuery({
    queryKey: ticketKeys.detail(account.id, reference),
    queryFn: ({ signal }) => read<TicketDetails>(path, signal),
  })
  const ticket = query.data

  return (
    <>
      <Link className="back-link" to={ticketPath(account.role)}>
        <ArrowLeft size={17} aria-hidden="true" />{' '}
        {customer ? 'Meus tickets' : 'Fila de atendimento'}
      </Link>
      {query.isPending && <Loading />}
      {query.isError && <QueryError error={query.error} retry={() => void query.refetch()} />}
      {ticket && !query.isError && (
        <>
          {state?.created && (
            <Notice kind="success">Ticket criado. Acompanhe o atendimento por aqui.</Notice>
          )}
          <section className="page-intro detail-intro">
            <div>
              <span className="eyebrow">
                <TicketIcon size={15} aria-hidden="true" /> {ticket.reference}
              </span>
              <h1>{ticket.title}</h1>
              <div className="intro-meta">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <span className="muted">
                  <CalendarDays size={15} aria-hidden="true" /> Aberto em{' '}
                  {dateTime(ticket.createdAt)}
                </span>
              </div>
            </div>
          </section>
          <div className="detail-grid">
            <div className="detail-main">
              <section className="panel detail-description" aria-labelledby="description-heading">
                <h2 id="description-heading">Descrição do ticket</h2>
                <p>{ticket.description}</p>
              </section>
              {!customer && (
                <div className="view-selector" aria-label="Visão do atendimento">
                  <button
                    className="button subtle"
                    aria-pressed={panel === 'conversation'}
                    onClick={() => setPanel('conversation')}
                  >
                    Conversa
                  </button>
                  <button
                    className="button subtle"
                    aria-pressed={panel === 'history'}
                    onClick={() => setPanel('history')}
                  >
                    Histórico
                  </button>
                </div>
              )}
              {panel === 'conversation' ? (
                <Conversation
                  path={path}
                  reference={reference}
                  closed={ticket.status === 'CLOSED'}
                />
              ) : (
                <StaffHistory path={path} reference={reference} />
              )}
            </div>
            <aside className="detail-side" aria-label="Detalhes operacionais">
              {!customer && (
                <section className="panel aside-card" aria-labelledby="context-heading">
                  <h2 id="context-heading">Identificação</h2>
                  <dl className="identity-list">
                    <div>
                      <dt>Solicitante</dt>
                      <dd className="mono">{ticket.requesterId}</dd>
                    </div>
                    <div>
                      <dt>Responsável</dt>
                      <dd className="mono" data-testid="assignee">
                        {ticket.assignedAgentId === account.id
                          ? 'Você'
                          : (ticket.assignedAgentId ?? 'Sem responsável')}
                      </dd>
                    </div>
                  </dl>
                </section>
              )}
              <TicketOperations ticket={ticket} path={path} />
              <SlaPanel sla={ticket.sla} />
              {customer && <CustomerTimeline ticket={ticket} />}
            </aside>
          </div>
        </>
      )}
    </>
  )
}

export function TicketDetail() {
  const { reference = '' } = useParams()
  const account = useAccount()
  return <TicketWorkspace key={account.id + ':' + reference} reference={reference} />
}
