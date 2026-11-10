import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, UserRoundCog, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { errorText, write } from '../api/client'
import { roleLabels, useAccount, type Account } from '../auth/session'
import { registrationSchema } from '../shared/forms'
import { Confirm, Empty, Field, Loading, Notice, PageNav, QueryError, dateTime } from '../shared/ui'
import { accountKey, useAccounts } from './accounts'

function AgentForm({ close, complete }: { close: () => void; complete: () => void }) {
  const [error, setError] = useState('')
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof registrationSchema>>({ resolver: zodResolver(registrationSchema) })

  async function submit(values: z.infer<typeof registrationSchema>) {
    setError('')
    try {
      await write('/admin/users/agents', 'POST', values)
      complete()
    } catch (failure) {
      setError(errorText(failure, 'Já existe uma conta com este e-mail.'))
    }
  }

  return (
    <section className="panel form-panel" aria-labelledby="agent-form">
      <h2 id="agent-form">Novo agente</h2>
      <p className="muted">Crie uma conta de suporte com acesso à fila de atendimento.</p>
      {error && <Notice>{error}</Notice>}
      <form className="form-stack" noValidate onSubmit={handleSubmit(submit)}>
        <Field label="Nome completo" error={errors.name?.message}>
          {(id, invalid) => (
            <input
              id={id}
              aria-invalid={invalid}
              aria-describedby={invalid ? id + '-error' : undefined}
              autoComplete="off"
              {...register('name')}
            />
          )}
        </Field>
        <Field label="E-mail" error={errors.email?.message}>
          {(id, invalid) => (
            <input
              id={id}
              aria-invalid={invalid}
              aria-describedby={invalid ? id + '-error' : undefined}
              autoComplete="off"
              type="email"
              {...register('email')}
            />
          )}
        </Field>
        <Field label="Senha inicial" error={errors.password?.message}>
          {(id, invalid) => (
            <input
              id={id}
              aria-invalid={invalid}
              aria-describedby={invalid ? id + '-error' : undefined}
              autoComplete="new-password"
              type="password"
              {...register('password')}
            />
          )}
        </Field>
        <div className="button-row">
          <button className="button secondary" type="button" onClick={close}>
            Cancelar
          </button>
          <button className="button primary" disabled={isSubmitting}>
            {isSubmitting ? 'Criando…' : 'Criar agente'}
          </button>
        </div>
      </form>
    </section>
  )
}

export function UsersPage() {
  const actor = useAccount()
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Account>()
  const [feedback, setFeedback] = useState('')
  const users = useAccounts(page)
  const toggle = useMutation({
    mutationFn: (user: Account) =>
      write('/admin/users/' + user.id + '/status', 'PATCH', { active: !user.active }),
    onSuccess: (_data, user) => setFeedback(user.active ? 'Conta desativada.' : 'Conta ativada.'),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: accountKey(actor.id) })
      setSelected(undefined)
    },
  })
  function complete() {
    setCreating(false)
    setFeedback('Conta de agente criada.')
    void client.invalidateQueries({ queryKey: accountKey(actor.id) })
  }

  return (
    <>
      <section className="page-intro">
        <div>
          <span className="eyebrow">
            <UserRoundCog size={15} aria-hidden="true" /> ADMINISTRAÇÃO
          </span>
          <h1>Contas</h1>
          <p className="muted">Gerencie o acesso de clientes e agentes ao SupportHub.</p>
        </div>
        {!creating && (
          <button
            className="button primary"
            onClick={() => {
              setCreating(true)
              setFeedback('')
            }}
          >
            <Plus size={18} aria-hidden="true" /> Novo agente
          </button>
        )}
      </section>
      {feedback && <Notice kind="success">{feedback}</Notice>}
      {toggle.isError && <Notice>{errorText(toggle.error)}</Notice>}
      {creating && <AgentForm close={() => setCreating(false)} complete={complete} />}
      <section className="panel table-panel" aria-labelledby="accounts-heading">
        <div className="panel-heading">
          <div className="panel-icon">
            <UsersRound size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="accounts-heading">Diretório de contas</h2>
            <p>
              {users.data ? `${users.data.totalElements} contas` : 'Clientes e equipe de suporte'}
            </p>
          </div>
        </div>
        {users.isPending && <Loading />}
        {users.isError && <QueryError error={users.error} retry={() => void users.refetch()} />}
        {users.data &&
          (users.data.items.length ? (
            <div className="table-scroll" role="region" aria-label="Lista de contas" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Conta</th>
                    <th>Papel</th>
                    <th>Acesso</th>
                    <th className="wide-col date-cell">Criada em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.items.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name}</strong>
                        <small className="table-subtitle">{user.email}</small>
                      </td>
                      <td>{roleLabels[user.role]}</td>
                      <td>
                        <span className={`badge ${user.active ? 'sla-met' : 'status-closed'}`}>
                          <span className="badge-dot" />
                          {user.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="wide-col date-cell">{dateTime(user.createdAt)}</td>
                      <td>
                        {user.role !== 'ADMIN' && (
                          <button
                            className="button secondary small"
                            aria-label={`${user.active ? 'Desativar' : 'Ativar'} conta de ${user.name}`}
                            onClick={() => {
                              setFeedback('')
                              toggle.reset()
                              setSelected(user)
                            }}
                          >
                            {user.active ? 'Desativar' : 'Ativar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Nenhuma conta nesta página">
              Use a paginação para consultar o diretório.
            </Empty>
          ))}
        {users.data && <PageNav data={users.data} change={setPage} />}
      </section>
      {selected && (
        <Confirm
          title={selected.active ? 'Desativar conta?' : 'Ativar conta?'}
          pending={toggle.isPending}
          close={() => setSelected(undefined)}
          confirm={() => toggle.mutate(selected)}
        >
          <p>
            {selected.active
              ? `O acesso de ${selected.name} será revogado, incluindo sessões existentes.`
              : `${selected.name} poderá entrar novamente no SupportHub.`}
          </p>
        </Confirm>
      )}
    </>
  )
}
