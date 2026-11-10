import type { Page } from '../api/client'
import { read } from '../api/client'
import type { Role } from '../auth/session'

export const statuses = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em atendimento',
  WAITING_CUSTOMER: 'Aguardando cliente',
  RESOLVED: 'Resolvido',
  CLOSED: 'Encerrado',
} as const

export const priorities = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
} as const
export const outcomes = { PENDING: 'Pendente', MET: 'No prazo', BREACHED: 'Vencido' } as const
export type Status = keyof typeof statuses
export type Priority = keyof typeof priorities
export type Outcome = keyof typeof outcomes
export type Visibility = 'PUBLIC' | 'INTERNAL'

export interface Sla {
  firstResponseDueAt: string
  firstResponseAt: string | null
  firstResponseStatus: Outcome
  resolutionDueAt: string
  resolvedAt: string | null
  resolutionStatus: Outcome
}

export interface Ticket {
  reference: string
  title: string
  status: Status
  priority: Priority
  requesterId: string
  assignedAgentId: string | null
  createdAt: string
  updatedAt: string
  sla: Sla
}

export interface TicketDetails extends Ticket {
  description: string
  closedAt: string | null
}

export interface Comment {
  id: string
  authorId: string
  body: string
  visibility: Visibility
  createdAt: string
}

export interface AuditEvent {
  id: number
  actorId: string
  type: string
  occurredAt: string
  previousValue: string | null
  newValue: string | null
  metadata: string | null
}

export const ticketKeys = {
  all: (accountId: string) => ['tickets', accountId] as const,
  list: (accountId: string, query: string) => ['tickets', accountId, 'list', query] as const,
  detail: (accountId: string, ref: string) => ['tickets', accountId, 'detail', ref] as const,
  feed: (accountId: string, ref: string, feed: string, page: number) =>
    ['tickets', accountId, 'detail', ref, feed, page] as const,
}

export function ticketApi(role: Role) {
  return role === 'CUSTOMER' ? '/tickets' : '/agent/tickets'
}

export function ticketPath(role: Role) {
  return role === 'CUSTOMER' ? '/tickets' : '/queue'
}

export function feed<T>(path: string, page: number, signal: AbortSignal) {
  return read<Page<T>>(path + '?page=' + page, signal)
}

// UI affordances mirror the current contract. Every transition is validated by Spring.
export function offeredTransitions(ticket: Ticket): Status[] {
  switch (ticket.status) {
    case 'OPEN':
      return ticket.assignedAgentId ? ['IN_PROGRESS'] : []
    case 'IN_PROGRESS':
      return ['WAITING_CUSTOMER', 'RESOLVED']
    case 'WAITING_CUSTOMER':
      return ['IN_PROGRESS', 'RESOLVED']
    case 'RESOLVED':
      return ['IN_PROGRESS', 'CLOSED']
    case 'CLOSED':
      return []
  }
}

export function activeTicket(ticket: Ticket) {
  return ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED'
}
