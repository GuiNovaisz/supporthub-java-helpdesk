import { useEffect, useId, useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, CircleAlert, Inbox, LoaderCircle } from 'lucide-react'
import { errorText, type Page } from '../api/client'

export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={19} className="spin" aria-hidden="true" />
      Carregando…
    </div>
  )
}

export function Notice({
  children,
  kind = 'error',
}: {
  children: ReactNode
  kind?: 'error' | 'success'
}) {
  return (
    <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'error' && <CircleAlert size={18} aria-hidden="true" />}
      {children}
    </div>
  )
}

export function QueryError({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Notice>
      {errorText(error)}
      {retry && (
        <button className="button secondary small" onClick={retry}>
          Tentar novamente
        </button>
      )}
    </Notice>
  )
}

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={23} aria-hidden="true" />
      </span>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  )
}

export function PageNav({ data, change }: { data: Page<unknown>; change: (page: number) => void }) {
  return (
    <nav className="pagination" aria-label="Paginação">
      <span>
        {data.totalElements
          ? `Página ${data.page + 1} de ${data.totalPages} · ${data.totalElements} registros`
          : '0 registros'}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Página anterior"
          disabled={data.page === 0}
          onClick={() => change(data.page - 1)}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          aria-label="Próxima página"
          disabled={data.page + 1 >= data.totalPages}
          onClick={() => change(data.page + 1)}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: (id: string, invalid: boolean) => ReactNode
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id, !!error)}
      {error && (
        <p className="field-error" id={id + '-error'} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Confirm({
  title,
  children,
  pending,
  close,
  confirm,
}: {
  title: string
  children: ReactNode
  pending: boolean
  close: () => void
  confirm: () => void
}) {
  const element = useRef<HTMLDialogElement>(null)
  const heading = useId()
  useEffect(() => {
    const dialog = element.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={element}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) close()
      }}
    >
      <h2 id={heading}>{title}</h2>
      <div className="muted">{children}</div>
      <div className="button-row">
        <button className="button secondary" disabled={pending} onClick={close}>
          Cancelar
        </button>
        <button className="button danger" disabled={pending} onClick={confirm}>
          {pending ? 'Confirmando…' : 'Confirmar'}
        </button>
      </div>
    </dialog>
  )
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
export function dateTime(value?: string | null) {
  return value ? dateFormat.format(new Date(value)) : '—'
}

export function shortId(value: string) {
  return value.slice(0, 8)
}
