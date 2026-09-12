import { hasPermission } from '@/Lib/auth/permissions'
import { getAuthSession } from '@/Lib/auth/session'
import { redirect } from 'next/navigation'

export async function requireFinancePage(nextPath: string) {
  const session = await getAuthSession()
  if (!session) redirect(`/login?next=${nextPath}`)
  const canView =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'finance.invoices.view') ||
    hasPermission(session.permissions, 'orders.financial.view')
  if (!canView) redirect('/quotes')
  return session
}
