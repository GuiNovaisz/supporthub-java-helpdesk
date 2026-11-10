import { Clock3, Signal } from 'lucide-react'
import { outcomes, priorities, statuses, type Outcome, type Priority, type Status } from './model'

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      <span className="badge-dot" />
      {statuses[status]}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`priority priority-${priority.toLowerCase()}`}>
      <Signal size={13} aria-hidden="true" /> {priorities[priority]}
    </span>
  )
}

export function SlaBadge({ outcome }: { outcome: Outcome }) {
  return (
    <span className={`badge sla-${outcome.toLowerCase()}`}>
      <Clock3 size={13} aria-hidden="true" />
      {outcomes[outcome]}
    </span>
  )
}
