import PublicPaymentPage from '@/components/payments/PublicPaymentPage'
import { tPayments } from '@/Lib/i18n/payments'
import { resolvePublicPaypalCheckoutReadiness } from '@/Lib/payments/paypal/publicCheckout'
import { resolvePaymentLink } from '@/Lib/payments/resolvePaymentLink'

export const dynamic = 'force-dynamic'

export default async function PublicPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<{ lang?: string }>
}) {
  const { token } = await params
  const query = searchParams ? await searchParams : {}
  const resolved = await resolvePaymentLink(token)
  if (!resolved.ok) {
    return (
      <main className="min-h-screen bg-[#f6f1ea] px-6 py-16 text-center">
        <h1 className="text-2xl font-black">{tPayments('pt', 'linkInvalid')}</h1>
      </main>
    )
  }

  const readiness = await resolvePublicPaypalCheckoutReadiness(resolved.invoice.company_id)
  const locale =
    query.lang === 'en' || query.lang === 'es' || query.lang === 'pt'
      ? query.lang
      : resolved.invoice.locale

  return (
    <PublicPaymentPage
      invoice={resolved.invoice}
      purpose={resolved.link.purpose}
      publicCheckout={readiness.ready}
      paypalClientId={readiness.clientId}
      paymentToken={token}
      locale={locale}
    />
  )
}
