import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowDownRight,
  ArrowRight,
  Headphones,
  Layers3,
  Moon,
  ShieldCheck,
  Sun,
  Ticket,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { errorText, write } from '../api/client'
import { credentialsSchema, registrationSchema } from '../shared/forms'
import { Field, Notice } from '../shared/ui'
import { useTheme } from '../app/theme'
import { useSession } from './session'

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <Headphones size={21} aria-hidden="true" />
      </span>
      Support<span>Hub</span>
    </span>
  )
}

export function ThemeButton() {
  const { theme, toggle } = useTheme()
  const label = theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'
  const Icon = theme === 'light' ? Moon : Sun
  return (
    <button className="icon-button" type="button" onClick={toggle} aria-label={label} title={label}>
      <Icon size={19} aria-hidden="true" />
    </button>
  )
}

export function AuthPage({ registration = false }: { registration?: boolean }) {
  const { signIn } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const form = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(
      registration ? registrationSchema : credentialsSchema.extend({ name: z.string() }),
    ),
    defaultValues: { name: '', email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function submit(values: z.infer<typeof registrationSchema>) {
    setError('')
    try {
      if (registration) {
        await write('/auth/register', 'POST', values)
        navigate('/login', { replace: true, state: { registered: true } })
      } else {
        await signIn({ email: values.email, password: values.password })
      }
    } catch (failure) {
      setError(errorText(failure, 'Já existe uma conta com este e-mail.'))
    }
  }

  return (
    <main className="auth-layout" id="main">
      <section className="auth-art" aria-labelledby="auth-brand-heading">
        <div className="auth-art-head">
          <Brand />
          <span className="edition">SERVICE DESK / 01</span>
        </div>
        <div className="art-content">
          <span className="art-kicker">
            <span /> CENTRAL DE ATENDIMENTO
          </span>
          <p className="art-headline" id="auth-brand-heading">
            O trabalho de suporte, em ordem.
          </p>
          <p>
            Abra solicitações, acompanhe prazos e encontre o contexto de cada atendimento em um só
            lugar.
          </p>
          <div className="art-diagram" aria-hidden="true">
            <span className="art-orbit orbit-one" />
            <span className="art-orbit orbit-two" />
            <span className="art-orbit orbit-three" />
            <div>
              <Ticket size={19} /> Solicitação
            </div>
            <ArrowDownRight size={17} />
            <div>
              <Layers3 size={19} /> Atendimento
            </div>
            <ArrowDownRight size={17} />
            <div>
              <ShieldCheck size={19} /> Resolução
            </div>
          </div>
        </div>
        <span className="art-footer">
          SUPPORTHUB <span>●</span> FULL STACK EXPERIENCE
        </span>
      </section>
      <section className="auth-panel" aria-label={registration ? 'Cadastro' : 'Login'}>
        <div className="auth-panel-top">
          <span className="auth-mobile-brand">
            <Brand />
          </span>
          <ThemeButton />
        </div>
        <div className="auth-content">
          <span className="eyebrow">
            {registration ? 'PRIMEIRO ACESSO' : 'ÁREA DE ATENDIMENTO'}
          </span>
          <h1>{registration ? 'Crie sua conta' : 'Entre no SupportHub'}</h1>
          <p className="muted">
            {registration
              ? 'Cadastre-se como cliente para abrir e acompanhar solicitações.'
              : 'Use seu e-mail e senha para acessar seu espaço de trabalho.'}
          </p>
          {location.state?.registered && !registration && (
            <Notice kind="success">Conta criada. Entre para continuar.</Notice>
          )}
          {error && <Notice>{error}</Notice>}
          <form className="form-stack" onSubmit={form.handleSubmit(submit)} noValidate>
            {registration && (
              <Field label="Nome completo" error={errors.name?.message}>
                {(id, invalid) => (
                  <input
                    id={id}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? id + '-error' : undefined}
                    autoComplete="name"
                    {...form.register('name')}
                  />
                )}
              </Field>
            )}
            <Field label="E-mail" error={errors.email?.message}>
              {(id, invalid) => (
                <input
                  id={id}
                  type="email"
                  aria-invalid={invalid}
                  aria-describedby={invalid ? id + '-error' : undefined}
                  autoComplete="email"
                  placeholder="nome@empresa.com"
                  {...form.register('email')}
                />
              )}
            </Field>
            <Field label="Senha" error={errors.password?.message}>
              {(id, invalid) => (
                <input
                  id={id}
                  type="password"
                  aria-invalid={invalid}
                  aria-describedby={invalid ? id + '-error' : undefined}
                  autoComplete={registration ? 'new-password' : 'current-password'}
                  {...form.register('password')}
                />
              )}
            </Field>
            {registration && <p className="form-hint">Use pelo menos 12 caracteres.</p>}
            <button className="button primary auth-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Aguarde…' : registration ? 'Criar conta' : 'Entrar'}{' '}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          <p className="auth-switch">
            {registration ? 'Já possui uma conta?' : 'Primeiro acesso?'}{' '}
            <Link to={registration ? '/login' : '/register'}>
              {registration ? 'Entrar' : 'Criar conta'}
            </Link>
          </p>
        </div>
        <footer className="auth-footer">
          <ShieldCheck size={16} aria-hidden="true" /> Acesso protegido por sessão
        </footer>
      </section>
    </main>
  )
}
