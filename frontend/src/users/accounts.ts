import { useQuery } from '@tanstack/react-query'
import { read, type Page } from '../api/client'
import { useAccount, type Account } from '../auth/session'

export const accountKey = (accountId: string) => ['accounts', accountId] as const

export function useAccounts(page: number) {
  const account = useAccount()
  return useQuery({
    queryKey: [...accountKey(account.id), page],
    queryFn: ({ signal }) => read<Page<Account>>('/admin/users?page=' + page + '&size=15', signal),
  })
}
