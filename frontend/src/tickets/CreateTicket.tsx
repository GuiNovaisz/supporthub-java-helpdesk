import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CircleHelp, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { errorText, write } from '../api/client'
import { useAccount } from '../auth/session'
import { textField } from '../shared/forms'
import { Field, Notice } from '../shared/ui'
import { ticketKeys, type TicketDetails } from './model'

const schema = z.object({ title: textField(160), description: textField(8000) })

export function CreateTicket() {
  const account = useAccount()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const { handleSubmit, register, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  })

  async function submit(values: z.infer<typeof schema>) {
    setError('')
    try {
      const ticket = await write<TicketDetails>('/tickets', 'POST', values)
      void client.invalidateQueries({ queryKey: ticketKeys.all(account.id) })
      navigate('/tickets/' + ticket.reference, { replace: true, state: { created: true } })
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  return (
    <>
      <Link className="back-link" to="/tickets">
        <ArrowLeft size={17} aria-hidden="true" /> Meus tickets
      </Link>
      <section className="page-intro">
        <div>
          <span className="eyebrow">
            <Plus size={15} aria-hidden="true" /> NOVA SOLICITAÇÃO
          </span>
          <h1>Novo ticket</h1>
          <p className="muted">Conte o que aconteceu para que o suporte possa ajudar.</p>
        </div>
      </section>
      <div className="detail-grid">
        <section className="panel form-panel" aria-labelledby="new-ticket-heading">
          <h2 id="new-ticket-heading">Detalhes da solicitação</h2>
          {error && <Notice>{error}</Notice>}
          <form className="form-stack" onSubmit={handleSubmit(submit)} noValidate>
            <Field label="Assunto" error={formState.errors.title?.message}>
              {(id, invalid) => (
                <input
                  id={id}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? id + '-error' : undefined}
                  placeholder="Ex. Não consigo acessar o portal"
                  {...register('title')}
                />
              )}
            </Field>
            <Field label="Descrição" error={formState.errors.description?.message}>
              {(id, invalid) => (
                <textarea
                  id={id}
                  rows={7}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? id + '-error' : undefined}
                  placeholder="O que você estava tentando fazer? Inclua os passos e a mensagem exibida."
                  {...register('description')}
                />
              )}
            </Field>
            <div className="button-row">
              <Link className="button secondary" to="/tickets">
                Cancelar
              </Link>
              <button className="button primary" disabled={formState.isSubmitting}>
                {formState.isSubmitting ? 'Enviando…' : 'Criar ticket'}{' '}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
        <aside className="panel aside-card">
          <div className="panel-icon">
            <CircleHelp size={20} aria-hidden="true" />
          </div>
          <h2>Antes de enviar</h2>
          <p className="muted">
            Descreva o impacto e quando o problema começou. Evite incluir senhas ou outros dados
            confidenciais.
          </p>
          <p className="muted">
            O ticket começa com prioridade média. A equipe pode ajustá-la durante a triagem.
          </p>
        </aside>
      </div>
    </>
  )
}
