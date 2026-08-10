import { headers } from 'next/headers'
import PublicMaterialDispatchClient from './PublicMaterialDispatchClient'
import { GET as getPublicDispatch } from '@/app/api/public/conferencia-saida/[token]/route'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { resolvePublicDispatchLocale } from '@/Lib/orders/materialDispatchConfirmation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type MaterialLine = {
  id: string
  description_snapshot: string
  material_type: string
  unit: string
  required_quantity: number
  separated_quantity: number
  checked_quantity: number
  dispatched_quantity: number
  status: string
}

export default async function PublicMaterialDispatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ lang?: string; locale?: string }>
}) {
  const { token } = await params
  const query = await searchParams
  const hdrs = await headers()
  const locale = resolvePublicDispatchLocale({
    queryLang: query.lang || query.locale,
    acceptLanguage: hdrs.get('accept-language'),
  })

  const res = await getPublicDispatch(
    new Request(`http://local/api/public/conferencia-saida/${token}`),
    { params: Promise.resolve({ token }) },
  )
  const payload = (await res.json()) as {
    found?: boolean
    expired?: boolean
    company_name?: string
    status?: string
    can_confirm?: boolean
    dispatch?: {
      service_order_number?: string
      event_date?: string
      start_time?: string | null
      end_time?: string | null
      venue_name?: string | null
      address_line?: string | null
      city?: string | null
      state?: string | null
      team_name?: string | null
      leader_name?: string | null
      materials?: MaterialLine[]
    }
  }

  if (!payload.found || !payload.dispatch) {
    const revoked = payload.status === 'revoked'
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="liquid-glass-card p-8 text-center">
          <h1 className="text-xl font-bold text-cdl-fg">
            {revoked
              ? tQuotesOrders(locale, 'publicDispatchLinkRevoked')
              : tQuotesOrders(locale, 'publicDispatchLinkInvalid')}
          </h1>
          <p className="mt-2 text-sm text-cdl-muted">
            {revoked
              ? tQuotesOrders(locale, 'publicDispatchLinkRevokedHint')
              : tQuotesOrders(locale, 'publicDispatchLinkInvalidHint')}
          </p>
        </div>
      </main>
    )
  }

  if (payload.expired) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="liquid-glass-card p-8 text-center">
          <h1 className="text-xl font-bold text-cdl-fg">
            {tQuotesOrders(locale, 'publicDispatchLinkExpired')}
          </h1>
          <p className="mt-2 text-sm text-cdl-muted">
            {tQuotesOrders(locale, 'publicDispatchLinkExpiredHint')}
          </p>
        </div>
      </main>
    )
  }

  return (
    <PublicMaterialDispatchClient
      token={token}
      locale={locale}
      companyName={payload.company_name || 'Catering'}
      initialStatus={payload.status || 'pending'}
      canConfirm={Boolean(payload.can_confirm)}
      dispatch={payload.dispatch as never}
    />
  )
}
