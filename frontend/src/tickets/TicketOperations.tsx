import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Hand } from 'lucide-react'
import { useState } from 'react'
import { errorText, write } from '../api/client'
import { useAccount } from '../auth/session'
import { Confirm, Notice } from '../shared/ui'
import { Assignment } from './Assignment'
import {
  activeTicket,
  offeredTransitions,
  priorities,
  statuses,
  ticketKeys,
  type TicketDetails,
} from './model'

type Action = {
  suffix: string
  endpoint?: string
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  success: string
  conflict?: string
}

export function TicketOperations({ ticket, path }: { ticket: TicketDetails; path: string }) {
  const account = useAccount()
  const client = useQueryClient()
  const [confirmClose, setConfirmClose] = useState(false)
  const update = useMutation({
    mutationFn: (action: Action) =>
      write((action.endpoint ?? path) + action.suffix, action.method, action.body),
    // Reconcile with the server even when claim loses a race.
    onSettled: () => client.invalidateQueries({ queryKey: ticketKeys.all(account.id) }),
  })
  const pending = update.isPending
  const customer = account.role === 'CUSTOMER'
  const admin = account.role === 'ADMIN'
  const assignmentEndpoint = '/admin/tickets/' + encodeURIComponent(ticket.reference)
  const canOperate = !customer && (admin || account.id === ticket.assignedAgentId)
  const active = activeTicket(ticket)
  const canClaim = account.role === 'AGENT' && active && !ticket.assignedAgentId
  const transitions = canOperate ? offeredTransitions(ticket) : []
  const visible = customer
    ? ticket.status === 'RESOLVED'
    : canClaim || (active && canOperate) || transitions.length > 0

  if (!visible && !update.isError && !update.isSuccess && !pending) return null

  function changeStatus(status: string) {
    update.mutate({
      suffix: '/status',
      method: 'PATCH',
      body: { status },
      success: 'Status atualizado.',
    })
  }

  return (
    <section className="panel aside-card operations" aria-labelledby="ops-heading">
      <div className="aside-heading">
        <span className="panel-icon">
          <ClipboardList size={19} aria-hidden="true" />
        </span>
        <h2 id="ops-heading">{customer ? 'Ações do ticket' : 'Operação'}</h2>
      </div>
      {update.isError && <Notice>{errorText(update.error, update.variables?.conflict)}</Notice>}
      {update.isSuccess && <Notice kind="success">{update.variables?.success}</Notice>}
      {customer && ticket.status === 'RESOLVED' && (
        <button
          className="button secondary"
          disabled={pending}
          onClick={() =>
            update.mutate({ suffix: '/reopen', method: 'POST', success: 'Ticket reaberto.' })
          }
        >
          Reabrir ticket
        </button>
      )}
      {canClaim && (
        <button
          className="button primary"
          disabled={pending}
          onClick={() =>
            update.mutate({
              suffix: '/claim',
              method: 'POST',
              success: 'Você assumiu o ticket.',
              conflict:
                'Outro atendimento alterou este ticket. A atribuição atual foi consultada novamente.',
            })
          }
        >
          <Hand size={17} aria-hidden="true" /> {pending ? 'Assumindo…' : 'Assumir ticket'}
        </button>
      )}
      {admin && active && (
        <Assignment
          assignee={ticket.assignedAgentId}
          pending={pending}
          assign={(agentId) =>
            update.mutate({
              endpoint: assignmentEndpoint,
              suffix: '/assignment',
              method: 'PUT',
              body: { agentId },
              success: 'Atribuição atualizada.',
            })
          }
          remove={() =>
            update.mutate({
              endpoint: assignmentEndpoint,
              suffix: '/assignment',
              method: 'DELETE',
              success: 'Atribuição removida.',
            })
          }
        />
      )}
      {canOperate && active && (
        <form
          className="operation-section form-stack compact"
          key={ticket.priority}
          onSubmit={(event) => {
            event.preventDefault()
            const priority = new FormData(event.currentTarget).get('priority')
            if (priority && priority !== ticket.priority)
              update.mutate({
                suffix: '/priority',
                method: 'PATCH',
                body: { priority },
                success: 'Prioridade atualizada.',
              })
          }}
        >
          <label className="field">
            <span>Prioridade operacional</span>
            <select name="priority" defaultValue={ticket.priority}>
              {Object.entries(priorities).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary" disabled={pending}>
            Salvar prioridade
          </button>
        </form>
      )}
      {transitions.length > 0 && (
        <form
          className="operation-section form-stack compact"
          key={ticket.status}
          onSubmit={(event) => {
            event.preventDefault()
            const status = String(new FormData(event.currentTarget).get('status') ?? '')
            if (status === 'CLOSED') setConfirmClose(true)
            else if (status) changeStatus(status)
          }}
        >
          <label className="field">
            <span>Próximo status</span>
            <select name="status" defaultValue="" required>
              <option value="" disabled>
                Selecione uma transição
              </option>
              {transitions.map((status) => (
                <option key={status} value={status}>
                  {statuses[status]}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary" disabled={pending}>
            Salvar status
          </button>
        </form>
      )}
      {confirmClose && (
        <Confirm
          title="Encerrar ticket?"
          pending={pending}
          close={() => setConfirmClose(false)}
          confirm={() => {
            setConfirmClose(false)
            changeStatus('CLOSED')
          }}
        >
          <p>Após o encerramento, o ticket não pode ser reaberto nem receber comentários.</p>
        </Confirm>
      )}
    </section>
  )
}
