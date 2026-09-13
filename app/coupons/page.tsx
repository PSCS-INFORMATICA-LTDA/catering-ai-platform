import { redirect } from 'next/navigation'
import CouponsDashboard from '@/components/coupons/CouponsDashboard'
import { hasPermission } from '@/Lib/auth/permissions'
import { getAuthSession } from '@/Lib/auth/session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CouponsPage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/coupons')
  if (
    !session.isPlatformAdmin &&
    !hasPermission(session.permissions, 'commercial.coupons.view')
  ) {
    redirect('/quotes')
  }
  return <CouponsDashboard />
}
