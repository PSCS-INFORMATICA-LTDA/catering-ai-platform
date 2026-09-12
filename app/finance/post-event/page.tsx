import FinancePostEventBoard from '@/components/finance/FinancePostEventBoard'
import { requireFinancePage } from '@/Lib/payments/requireFinancePage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FinancePostEventPage() {
  await requireFinancePage('/finance/post-event')
  return <FinancePostEventBoard />
}
