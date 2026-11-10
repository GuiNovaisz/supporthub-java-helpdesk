import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LockKeyhole, MessageCircle, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { errorText, write } from '../api/client'
import { useAccount } from '../auth/session'
import { textField } from '../shared/forms'
import { dateTime, Empty, Field, Loading, Notice, PageNav, QueryError, shortId } from '../shared/ui'
import { feed, ticketKeys, type Comment, type Visibility } from '../tickets/model'

const schema = z.object({ body: textField(4000) })

export function Conversation({
  path,
  reference,
  closed,
}: {
  path: string
  reference: string
  closed: boolean
}) {
  const account = useAccount()
  const client = useQueryClient()
  const staff = account.role !== 'CUSTOMER'
  const [page, setPage] = useState(0)
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const comments = useQuery({
    queryKey: ticketKeys.feed(account.id, reference, 'comments', page),
    queryFn: ({ signal }) => feed<Comment>(path + '/comments', page, signal),
  })
  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { body: '' },
  })

  async function submit(values: z.infer<typeof schema>) {
    setError('')
    setFeedback('')
    try {
      const published = staff ? visibility : 'PUBLIC'
      await write(path + '/comments', 'POST', { ...values, visibility: published })
      const data = comments.data
      if (data) setPage(Math.floor(data.totalElements / data.size))
      reset()
      setFeedback(published === 'INTERNAL' ? 'Nota interna adicionada.' : 'Comentário enviado.')
    } catch (failure) {
      setError(errorText(failure, 'O ticket mudou e pode não aceitar novos comentários.'))
    } finally {
      await client.invalidateQueries({ queryKey: ticketKeys.all(account.id) })
    }
  }

  return (
    <section className="panel conversation" aria-labelledby="conversation-heading">
      <div className="panel-heading">
        <div className="panel-icon">
          <MessageCircle size={21} aria-hidden="true" />
        </div>
        <div>
          <h2 id="conversation-heading">Conversa</h2>
          <p>
            {staff
              ? 'Respostas ao cliente e notas para a equipe'
              : 'Mensagens compartilhadas com o suporte'}
          </p>
        </div>
      </div>
      {comments.isPending && <Loading />}
      {comments.isError && (
        <QueryError error={comments.error} retry={() => void comments.refetch()} />
      )}
      {comments.data &&
        (comments.data.items.length ? (
          <ol className="comment-list">
            {comments.data.items.map((item) => (
              <li
                key={item.id}
                className={`comment ${item.visibility === 'INTERNAL' ? 'internal' : ''}`}
              >
                <div className="comment-meta">
                  <span
                    className={`badge ${item.visibility === 'INTERNAL' ? 'internal-badge' : 'sla-met'}`}
                  >
                    {item.visibility === 'INTERNAL' && <LockKeyhole size={13} aria-hidden="true" />}
                    {item.visibility === 'INTERNAL' ? 'Nota interna' : 'Comentário público'}
                  </span>
                  <small>
                    {item.authorId === account.id ? 'Você' : shortId(item.authorId)} ·{' '}
                    {dateTime(item.createdAt)}
                  </small>
                </div>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="A conversa começa aqui">
            Nenhuma mensagem foi registrada neste ticket.
          </Empty>
        ))}
      {comments.data && comments.data.totalPages > 1 && (
        <PageNav data={comments.data} change={setPage} />
      )}
      {!closed && (
        <form
          className={`composer form-stack ${visibility === 'INTERNAL' ? 'internal-composer' : ''}`}
          onSubmit={handleSubmit(submit)}
          noValidate
        >
          {staff && (
            <fieldset className="visibility-choice" disabled={isSubmitting}>
              <legend>Visibilidade da mensagem</legend>
              <label>
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === 'PUBLIC'}
                  onChange={() => setVisibility('PUBLIC')}
                />{' '}
                Resposta pública
              </label>
              <label>
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === 'INTERNAL'}
                  onChange={() => setVisibility('INTERNAL')}
                />{' '}
                Nota interna
              </label>
            </fieldset>
          )}
          {staff && visibility === 'INTERNAL' && (
            <p className="visibility-warning">
              <LockKeyhole size={16} aria-hidden="true" /> Visível apenas à equipe de suporte.
            </p>
          )}
          <Field
            label={visibility === 'INTERNAL' ? 'Escreva uma nota interna' : 'Escreva um comentário'}
            error={errors.body?.message}
          >
            {(id, invalid) => (
              <textarea
                id={id}
                aria-invalid={invalid}
                aria-describedby={invalid ? id + '-error' : undefined}
                rows={3}
                {...register('body')}
              />
            )}
          </Field>
          {error && <Notice>{error}</Notice>}
          {feedback && <Notice kind="success">{feedback}</Notice>}
          <div className="button-row">
            <button className="button primary" disabled={isSubmitting}>
              <Send size={16} aria-hidden="true" />
              {isSubmitting
                ? 'Enviando…'
                : visibility === 'INTERNAL'
                  ? 'Adicionar nota interna'
                  : 'Enviar comentário'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
