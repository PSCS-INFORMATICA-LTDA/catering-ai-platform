import FinanceRefundsBoard from '@/components/finance/FinanceRefundsBoard'
import { requireFinancePage } from '@/Lib/payments/requireFinancePage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FinanceRefundsPage() {
  await requireFinancePage('/finance/refunds')
  return <FinanceRefundsBoard />
}
