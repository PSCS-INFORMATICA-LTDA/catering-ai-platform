import FinancePscsOneBoard from '@/components/finance/FinancePscsOneBoard'
import { requireFinancePage } from '@/Lib/payments/requireFinancePage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FinancePscsOnePage() {
  await requireFinancePage('/finance/pscs-one')
  return <FinancePscsOneBoard />
}
