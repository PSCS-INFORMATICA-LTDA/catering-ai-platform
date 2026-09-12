import FinanceReconciliationBoard from '@/components/finance/FinanceReconciliationBoard'
import { requireFinancePage } from '@/Lib/payments/requireFinancePage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FinanceReconciliationPage() {
  await requireFinancePage('/finance/reconciliation')
  return <FinanceReconciliationBoard />
}
