import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { ApiError, read, sessionEvents, write } from '../api/client'

export type Role = 'CUSTOMER' | 'AGENT' | 'ADMIN'

export interface Account {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  createdAt: string
  updatedAt: string
}

const sessionKey = ['session'] as const

async function identity(signal?: AbortSignal) {
  try {
    return await read<Account>('/auth/me', signal)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

function useSessionState() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: sessionKey, queryFn: ({ signal }) => identity(signal) })

  useEffect(() => {
    const expired = () => {
      void client.cancelQueries()
      client.setQueryData(sessionKey, null)
      client.removeQueries({ predicate: ({ queryKey }) => queryKey[0] !== 'session' })
    }
    const revalidate = () => void client.invalidateQueries({ queryKey: sessionKey })
    sessionEvents.addEventListener('expired', expired)
    sessionEvents.addEventListener('revalidate', revalidate)
    return () => {
      sessionEvents.removeEventListener('expired', expired)
      sessionEvents.removeEventListener('revalidate', revalidate)
    }
  }, [client])

  async function setIdentity(account: Account | null) {
    await client.cancelQueries()
    client.removeQueries({ predicate: ({ queryKey }) => queryKey[0] !== 'session' })
    client.setQueryData(sessionKey, account)
  }

  async function signIn(credentials: { email: string; password: string }) {
    await write('/auth/login', 'POST', credentials)
    const account = await identity()
    if (!account) throw new ApiError(401)
    await setIdentity(account)
  }

  async function signOut() {
    await write('/auth/logout', 'POST')
    await setIdentity(null)
  }

  return { query, signIn, signOut }
}

const SessionContext = createContext<ReturnType<typeof useSessionState> | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSessionState()
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('SessionProvider is required')
  return session
}

export function useAccount() {
  const { query } = useSession()
  if (!query.data) throw new Error('An authenticated route is required')
  return query.data
}

export const roleLabels: Record<Role, string> = {
  CUSTOMER: 'Cliente',
  AGENT: 'Agente',
  ADMIN: 'Administrador',
}

export function landing(role: Role) {
  return role === 'CUSTOMER' ? '/tickets' : '/queue'
}
