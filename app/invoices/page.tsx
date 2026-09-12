import InvoicesDashboard from '@/components/payments/InvoicesDashboard'
import { hasPermission } from '@/Lib/auth/permissions'
import { getAuthSession } from '@/Lib/auth/session'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InvoicesPage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/invoices')

  const canView =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'finance.invoices.view') ||
    hasPermission(session.permissions, 'orders.financial.view')
  if (!canView) redirect('/quotes')

  return <InvoicesDashboard />
}
