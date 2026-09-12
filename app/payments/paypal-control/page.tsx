import PaypalControlCenter from '@/components/payments/PaypalControlCenter'
import { canViewFinanceObservability } from '@/Lib/payments/financeObservabilityAuth'
import { getAuthSession } from '@/Lib/auth/session'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PaypalControlPage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/payments/paypal-control')
  if (!canViewFinanceObservability(session)) redirect('/quotes')
  return <PaypalControlCenter />
}
