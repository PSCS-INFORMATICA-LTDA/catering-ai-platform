import FinanceControlCenter from '@/components/finance/FinanceControlCenter'
import { requireFinancePage } from '@/Lib/payments/requireFinancePage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FinanceHomePage() {
  await requireFinancePage('/finance')
  return <FinanceControlCenter />
}
