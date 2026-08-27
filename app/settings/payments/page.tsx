import PaymentSettingsDashboard from '@/components/settings/PaymentSettingsDashboard'
import { hasPermission } from '@/Lib/auth/permissions'
import { requireSessionCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import { tPaymentSettings } from '@/Lib/i18n/paymentSettings'
import { resolveAuthLocale } from '@/Lib/i18n/authUsers'
import {
  ensurePaypalWebhookRouteKey,
  PAYMENT_SETTINGS_PERMISSION,
  toPublicPaypalSettings,
} from '@/Lib/payments/companyPaypal'
import {
  ensureOfflineMethods,
  loadCompanyPaymentMethods,
} from '@/Lib/payments/companyProviders'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PaymentSettingsPage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/settings/payments')

  const allowed =
    session.isPlatformAdmin ||
    hasPermission(session.permissions, PAYMENT_SETTINGS_PERMISSION)
  if (!allowed) redirect('/quotes')

  const companyContext = requireSessionCompanyId(session)
  if (!companyContext.ok) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold text-red-500">Pagamentos</h1>
        <p className="mt-3 text-sm text-neutral-600">company_context_required</p>
      </main>
    )
  }
  const companyId = companyContext.companyId
  const locale = resolveAuthLocale(session.appUser?.preferred_language)

  const { data: company, error } = await getSupabaseServerClient()
    .from('companies')
    .select('id, company_name, trade_name')
    .eq('id', companyId)
    .maybeSingle()

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold text-red-500">
          {tPaymentSettings(locale, 'title')}
        </h1>
        <pre className="mt-3 text-sm">{error.message}</pre>
      </main>
    )
  }

  await ensureOfflineMethods(companyId)
  await ensurePaypalWebhookRouteKey(companyId)
  const paypal = await toPublicPaypalSettings(companyId)
  const methods = await loadCompanyPaymentMethods(companyId)

  return (
    <PaymentSettingsDashboard
      companyName={company?.trade_name || company?.company_name || ''}
      initialPaypal={paypal}
      initialMethods={methods}
    />
  )
}
