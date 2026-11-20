import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUpRight,
  Filter,
  ListFilter,
  Plus,
  Ticket as TicketIcon,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { read, type Page } from '../api/client'
import { useAccount } from '../auth/session'
import { dateTime, Empty, Loading, Notice, PageNav, QueryError, shortId } from '../shared/ui'
import { PriorityBadge, SlaBadge, StatusBadge } from './Badges'
import {
  outcomes,
  priorities,
  statuses,
  ticketApi,
  ticketKeys,
  ticketPath,
  type Ticket,
} from './model'

const sortOptions = {
  CREATED_AT: 'Criação',
  UPDATED_AT: 'Última atividade',
  FIRST_RESPONSE_DUE_AT: 'Prazo de primeira resposta',
  RESOLUTION_DUE_AT: 'Prazo de resolução',
}
const basic = ['status', 'priority', 'sort', 'direction']
const operational = ['assigned', 'requesterId', 'agentId', 'firstResponseSla', 'resolutionSla']
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

function FilterSelect({
  name,
  label,
  options,
  value,
  empty,
}: {
  name: string
  label: string
  options: Record<string, string>
  value: string
  empty?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        {empty && <option value="">{empty}</option>}
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

export function TicketList() {
  const account = useAccount()
  const customer = account.role === 'CUSTOMER'
  const [params, setParams] = useSearchParams()
  const [filterError, setFilterError] = useState('')
  const allowed = customer ? basic : [...basic, ...operational]
  const selected = new URLSearchParams()
  for (const name of [...allowed, 'page']) {
    const value = params.get(name)
    if (value) selected.set(name, value)
  }
  selected.set('size', '10')
  const query = selected.toString()
  const tickets = useQuery({
    queryKey: ticketKeys.list(account.id, query),
    queryFn: ({ signal }) => read<Page<Ticket>>(ticketApi(account.role) + '?' + query, signal),
  })
  const hasFilters = allowed.some((name) => params.has(name))

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const filters = new URLSearchParams()
    for (const name of allowed) {
      const value = String(form.get(name) ?? '').trim()
      if (!value) continue
      if ((name === 'agentId' || name === 'requesterId') && !uuid.test(value)) {
        setFilterError('Informe um ID completo no formato UUID para filtrar por conta.')
        return
      }
      if ((name === 'sort' && value === 'CREATED_AT') || (name === 'direction' && value === 'DESC'))
        continue
      filters.set(name, value)
    }
    setFilterError('')
    setParams(filters)
  }

  return (
    <>
      <section className="page-intro">
        <div>
          <span className="eyebrow">
            <TicketIcon size={14} aria-hidden="true" /> ATENDIMENTO
          </span>
          <h1>{customer ? 'Meus tickets' : 'Fila de atendimento'}</h1>
          <p className="muted">
            {customer
              ? 'Acompanhe suas solicitações e converse com o suporte.'
              : 'Organize solicitações, acompanhe prazos e priorize o atendimento.'}
          </p>
        </div>
        {customer && (
          <Link className="button primary" to="/tickets/new">
            <Plus size={19} aria-hidden="true" /> Novo ticket
          </Link>
        )}
      </section>
      <section className="panel table-panel" aria-labelledby="tickets-heading">
        <div className="panel-heading">
          <div className="panel-icon">
            <ListFilter size={21} aria-hidden="true" />
          </div>
          <div>
            <h2 id="tickets-heading">{customer ? 'Minhas solicitações' : 'Tickets da fila'}</h2>
            <p>
              {tickets.data
                ? `${tickets.data.totalElements} ${tickets.data.totalElements === 1 ? 'resultado' : 'resultados'}`
                : 'Lista de solicitações'}
            </p>
          </div>
        </div>
        <form className="filters" key={query} onSubmit={apply}>
          <div className="filter-row">
            <FilterSelect
              name="status"
              label="Status"
              options={statuses}
              value={params.get('status') ?? ''}
              empty="Todos os status"
            />
            <FilterSelect
              name="priority"
              label="Prioridade"
              options={priorities}
              value={params.get('priority') ?? ''}
              empty="Todas as prioridades"
            />
            <FilterSelect
              name="sort"
              label="Ordenar por"
              options={sortOptions}
              value={params.get('sort') ?? 'CREATED_AT'}
            />
            <FilterSelect
              name="direction"
              label="Ordem"
              options={{ DESC: 'Decrescente', ASC: 'Crescente' }}
              value={params.get('direction') ?? 'DESC'}
            />
            <button className="button secondary" type="submit">
              <Filter size={16} aria-hidden="true" /> Filtrar
            </button>
            {hasFilters && (
              <button
                className="button subtle"
                type="button"
                onClick={() => {
                  setFilterError('')
                  setParams({})
                }}
              >
                Limpar
              </button>
            )}
          </div>
          {!customer && (
            <details open={operational.some((name) => params.has(name)) || undefined}>
              <summary>Filtros operacionais</summary>
              <div className="filter-row advanced">
                <FilterSelect
                  name="assigned"
                  label="Atribuição"
                  options={{ true: 'Atribuído', false: 'Sem responsável' }}
                  value={params.get('assigned') ?? ''}
                  empty="Todas"
                />
                <label className="field">
                  <span>ID do solicitante</span>
                  <input
                    name="requesterId"
                    defaultValue={params.get('requesterId') ?? ''}
                    placeholder="UUID"
                  />
                </label>
                <label className="field">
                  <span>ID do agente</span>
                  <input
                    name="agentId"
                    defaultValue={params.get('agentId') ?? ''}
                    placeholder="UUID"
                  />
                </label>
                <FilterSelect
                  name="firstResponseSla"
                  label="SLA de primeira resposta"
                  options={outcomes}
                  value={params.get('firstResponseSla') ?? ''}
                  empty="Todos"
                />
                <FilterSelect
                  name="resolutionSla"
                  label="SLA de resolução"
                  options={outcomes}
                  value={params.get('resolutionSla') ?? ''}
                  empty="Todos"
                />
                <button className="button secondary" type="submit">
                  Aplicar filtros operacionais
                </button>
              </div>
            </details>
          )}
          {filterError && <Notice>{filterError}</Notice>}
        </form>
        {tickets.isPending && <Loading />}
        {tickets.isError && (
          <QueryError error={tickets.error} retry={() => void tickets.refetch()} />
        )}
        {tickets.data &&
          (tickets.data.items.length ? (
            <div className="table-scroll" role="region" aria-label="Lista de tickets" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Status</th>
                    <th className="priority-col">Prioridade</th>
                    {!customer && (
                      <>
                        <th className="wide-col">Solicitante</th>
                        <th className="wide-col">Responsável</th>
                      </>
                    )}
                    <th>SLA resolução</th>
                    <th className="wide-col date-cell">
                      Atualizado <ArrowDown size={13} aria-hidden="true" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.data.items.map((ticket) => (
                    <tr key={ticket.reference}>
                      <td>
                        <Link
                          className="ticket-link"
                          to={ticketPath(account.role) + '/' + ticket.reference}
                        >
                          <span className="ticket-ref">{ticket.reference}</span>
                          <strong>{ticket.title}</strong>
                          <ArrowUpRight size={15} aria-hidden="true" />
                        </Link>
                      </td>
                      <td>
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="priority-col">
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      {!customer && (
                        <>
                          <td className="wide-col">
                            <span className="mono" title={ticket.requesterId}>
                              {shortId(ticket.requesterId)}
                            </span>
                          </td>
                          <td className="wide-col">
                            {!ticket.assignedAgentId ? (
                              <span className="muted">Sem responsável</span>
                            ) : ticket.assignedAgentId === account.id ? (
                              'Você'
                            ) : (
                              <span className="mono" title={ticket.assignedAgentId}>
                                {shortId(ticket.assignedAgentId)}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                      <td>
                        <SlaBadge outcome={ticket.sla.resolutionStatus} />
                      </td>
                      <td className="wide-col date-cell">{dateTime(ticket.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Nenhum ticket encontrado">
              {hasFilters
                ? 'Ajuste os filtros para ampliar a busca.'
                : customer
                  ? 'Abra um ticket para falar com nossa equipe.'
                  : 'Novos tickets aparecerão nesta fila.'}
            </Empty>
          ))}
        {tickets.data && (
          <PageNav
            data={tickets.data}
            change={(page) =>
              setParams((previous) => {
                const next = new URLSearchParams(previous)
                next.set('page', String(page))
                return next
              })
            }
          />
        )}
      </section>
    </>
  )
}
