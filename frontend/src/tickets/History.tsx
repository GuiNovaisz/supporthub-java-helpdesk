import { useQuery } from '@tanstack/react-query'
import { History as HistoryIcon } from 'lucide-react'
import { useState } from 'react'
import { useAccount } from '../auth/session'
import { dateTime, Empty, Loading, PageNav, QueryError, shortId } from '../shared/ui'
import {
  feed,
  priorities,
  statuses,
  ticketKeys,
  type AuditEvent,
  type TicketDetails,
} from './model'

const eventNames: Record<string, string> = {
  CREATED: 'Ticket criado',
  SLA_CONFIGURED: 'Prazos definidos',
  STATUS_CHANGED: 'Status alterado',
  RESOLVED: 'Ticket resolvido',
  CLOSED: 'Ticket encerrado',
  REOPENED: 'Ticket reaberto',
  PRIORITY_CHANGED: 'Prioridade alterada',
  ASSIGNED: 'Agente atribuído',
  UNASSIGNED: 'Atribuição removida',
  REASSIGNED: 'Agente reatribuído',
  PUBLIC_COMMENT: 'Comentário público publicado',
  INTERNAL_COMMENT: 'Nota interna adicionada',
  FIRST_RESPONSE: 'Primeira resposta registrada',
}

const values: Record<string, string> = { ...priorities, ...statuses }

export function StaffHistory({ reference, path }: { reference: string; path: string }) {
  const account = useAccount()
  const [page, setPage] = useState(0)
  const events = useQuery({
    queryKey: ticketKeys.feed(account.id, reference, 'history', page),
    queryFn: ({ signal }) => feed<AuditEvent>(path + '/history', page, signal),
  })
  return (
    <section className="panel conversation" aria-labelledby="audit-heading">
      <div className="panel-heading">
        <div className="panel-icon">
          <HistoryIcon size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 id="audit-heading">Histórico do ticket</h2>
          <p>Eventos registrados pelo servidor</p>
        </div>
      </div>
      {events.isPending && <Loading />}
      {events.isError && <QueryError error={events.error} retry={() => void events.refetch()} />}
      {events.data &&
        (events.data.items.length ? (
          <ol className="timeline audit-list">
            {events.data.items.map((event) => (
              <li key={event.id}>
                <strong>{eventNames[event.type] ?? 'Evento registrado'}</strong>
                {event.previousValue && event.newValue && (
                  <span className="muted">
                    {values[event.previousValue] ?? event.previousValue} →{' '}
                    {values[event.newValue] ?? event.newValue}
                  </span>
                )}
                <small>
                  {event.actorId === account.id ? 'Você' : shortId(event.actorId)} ·{' '}
                  {dateTime(event.occurredAt)}
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="Sem eventos nesta página">
            O histórico aparecerá aqui quando houver eventos.
          </Empty>
        ))}
      {events.data && events.data.totalPages > 1 && <PageNav data={events.data} change={setPage} />}
    </section>
  )
}

export function CustomerTimeline({ ticket }: { ticket: TicketDetails }) {
  const events = [
    ['Ticket aberto', ticket.createdAt],
    ['Primeira resposta pública', ticket.sla.firstResponseAt],
    ['Resolução registrada', ticket.sla.resolvedAt],
    ['Ticket encerrado', ticket.closedAt],
  ] as const
  return (
    <section className="panel aside-card" aria-labelledby="timeline-heading">
      <div className="aside-heading">
        <span className="panel-icon">
          <HistoryIcon size={19} aria-hidden="true" />
        </span>
        <h2 id="timeline-heading">Linha do tempo</h2>
      </div>
      <ol className="timeline">
        {events
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <li key={label}>
              <strong>{label}</strong>
              <small>{dateTime(value)}</small>
            </li>
          ))}
      </ol>
    </section>
  )
}
