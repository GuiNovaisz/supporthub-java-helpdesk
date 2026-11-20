import { Timer } from 'lucide-react'
import { dateTime } from '../shared/ui'
import { SlaBadge } from '../tickets/Badges'
import type { Sla } from '../tickets/model'

export function SlaPanel({ sla }: { sla: Sla }) {
  return (
    <section className="panel aside-card sla-panel" aria-labelledby="sla-heading">
      <div className="aside-heading">
        <span className="panel-icon">
          <Timer size={19} aria-hidden="true" />
        </span>
        <h2 id="sla-heading">Prazos de atendimento</h2>
      </div>
      {[
        {
          label: 'Primeira resposta',
          due: sla.firstResponseDueAt,
          at: sla.firstResponseAt,
          outcome: sla.firstResponseStatus,
        },
        {
          label: 'Resolução',
          due: sla.resolutionDueAt,
          at: sla.resolvedAt,
          outcome: sla.resolutionStatus,
        },
      ].map((item) => (
        <div className="sla-item" key={item.label}>
          <div>
            <strong>{item.label}</strong>
            <SlaBadge outcome={item.outcome} />
          </div>
          <dl>
            <div>
              <dt>Prazo original</dt>
              <dd>{dateTime(item.due)}</dd>
            </div>
            <div>
              <dt>Registrado em</dt>
              <dd>{dateTime(item.at)}</dd>
            </div>
          </dl>
        </div>
      ))}
    </section>
  )
}
