import { useState } from 'react'
import { Confirm, Loading, PageNav, QueryError } from '../shared/ui'
import { useAccounts } from '../users/accounts'

export function Assignment({
  assignee,
  pending,
  assign,
  remove,
}: {
  assignee: string | null
  pending: boolean
  assign: (agentId: string) => void
  remove: () => void
}) {
  const [page, setPage] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const accounts = useAccounts(page)
  const agents = accounts.data?.items.filter((user) => user.active && user.role === 'AGENT') ?? []
  return (
    <div className="operation-section">
      <h3>Atribuição</h3>
      {accounts.isPending && <Loading />}
      {accounts.isError && (
        <QueryError error={accounts.error} retry={() => void accounts.refetch()} />
      )}
      {accounts.data && (
        <>
          {agents.length ? (
            <form
              className="form-stack compact"
              key={page}
              onSubmit={(event) => {
                event.preventDefault()
                const id = String(new FormData(event.currentTarget).get('agent') ?? '')
                if (id) assign(id)
              }}
            >
              <label className="field">
                <span>Agente responsável</span>
                <select name="agent" defaultValue="" required>
                  <option value="" disabled>
                    Selecione um agente ativo
                  </option>
                  {agents.map((user) => (
                    <option key={user.id} value={user.id} disabled={user.id === assignee}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button secondary" disabled={pending}>
                {assignee ? 'Reatribuir' : 'Atribuir'}
              </button>
            </form>
          ) : (
            <p className="muted">Nenhum agente ativo nesta página.</p>
          )}
          {accounts.data.totalPages > 1 && <PageNav data={accounts.data} change={setPage} />}
        </>
      )}
      {assignee && (
        <button className="button subtle" disabled={pending} onClick={() => setConfirming(true)}>
          Remover atribuição
        </button>
      )}
      {confirming && (
        <Confirm
          title="Remover atribuição?"
          pending={pending}
          close={() => setConfirming(false)}
          confirm={() => {
            setConfirming(false)
            remove()
          }}
        >
          <p>O ticket voltará a ficar sem responsável na fila.</p>
        </Confirm>
      )}
    </div>
  )
}
