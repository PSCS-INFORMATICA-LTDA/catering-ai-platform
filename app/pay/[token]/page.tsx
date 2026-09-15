import type { Metadata } from 'next'
import { headers } from 'next/headers'
import PublicPaymentPage from '@/components/payments/PublicPaymentPage'
import { tPayments } from '@/Lib/i18n/payments'
import { invoiceAmountContext, resolveServerPurposeAmounts } from '@/Lib/payments/loadInvoiceAmountDue'
import { loadCompanyTimezone } from '@/Lib/payments/loadCompanyTimezone'
import {
  availabilityFromInvoiceSnapshot,
  isPurposeAvailable,
} from '@/Lib/payments/paymentPurposeAvailability'
import { loadPaymentOgBrandFromToken } from '@/Lib/payments/loadPaymentOgBrand'
import {
  isAppPublicLogoPath,
  isCompanyOgId,
  PAYMENT_OG_FALLBACK_IMAGE_PATH,
  paymentOgMetadataIsSafe,
  resolvePaymentOgOrigin,
} from '@/Lib/payments/paymentOgCopy'
import { resolvePublicPaypalCheckoutReadiness } from '@/Lib/payments/paypal/publicCheckout'
import { resolvePaymentLink } from '@/Lib/payments/resolvePaymentLink'

export const dynamic = 'force-dynamic'

async function paymentPageOrigin() {
  const headerList = await headers()
  return resolvePaymentOgOrigin({
    forwardedHost: headerList.get('x-forwarded-host'),
    host: headerList.get('host'),
    forwardedProto: headerList.get('x-forwarded-proto'),
    vercelUrl: process.env.VERCEL_URL,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  })
}

function paymentOgImagePath(companyId: string | null): string {
  return isCompanyOgId(companyId)
    ? `/api/public/company-brand/${companyId}/og`
    : PAYMENT_OG_FALLBACK_IMAGE_PATH
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<{ lang?: string }>
}): Promise<Metadata> {
  const { token } = await params
  const query = searchParams ? await searchParams : {}
  const [brand, origin] = await Promise.all([
    loadPaymentOgBrandFromToken(token, query.lang),
    paymentPageOrigin(),
  ])
  const imagePath = paymentOgImagePath(brand.companyId)
  const metadata = {
    title: brand.displayName,
    description: brand.description,
    imagePath,
  }
  if (!paymentOgMetadataIsSafe(metadata)) {
    return {
      metadataBase: new URL(origin),
      title: 'Catering AI',
      description: tPayments('pt', 'ogPaymentDescription'),
      robots: { index: false, follow: false },
    }
  }
  return {
    metadataBase: new URL(origin),
    title: brand.displayName,
    description: brand.description,
    openGraph: {
      title: brand.displayName,
      description: brand.description,
      type: 'website',
      images: [{ url: imagePath, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: brand.displayName,
      description: brand.description,
      images: [imagePath],
    },
    robots: { index: false, follow: false },
  }
}

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
  const [brand, amounts, timezone] = await Promise.all([
    loadPaymentOgBrandFromToken(token, locale),
    resolveServerPurposeAmounts(invoiceAmountContext(resolved.invoice)),
    loadCompanyTimezone(resolved.invoice.company_id),
  ])
  const amountDue =
    resolved.link.purpose === 'deposit'
      ? amounts.depositDue
      : resolved.link.purpose === 'balance'
        ? amounts.balanceDue
        : amounts.fullDue
  const availability = availabilityFromInvoiceSnapshot({
    snapshot: resolved.invoice.snapshot,
    invoiceKind: resolved.invoice.invoice_kind,
    invoiceStatus: resolved.invoice.status,
    depositDue: amounts.depositDue,
    balanceDue: amounts.balanceDue,
    fullDue: amounts.fullDue,
    companyTimezone: timezone,
  })
  const purposeAvailable = isPurposeAvailable(availability, resolved.link.purpose)

  return (
    <PublicPaymentPage
      invoice={resolved.invoice}
      purpose={resolved.link.purpose}
      amountDue={amountDue}
      invoiceOutstanding={amounts.fullDue}
      companyDisplayName={brand.displayName}
      companyLogoSrc={isAppPublicLogoPath(brand.logoUrl) ? brand.logoUrl : null}
      publicCheckout={readiness.ready && purposeAvailable}
      paypalClientId={readiness.clientId}
      paymentToken={token}
      locale={locale}
      purposeAvailable={purposeAvailable}
      purposeAvailableAt={availability.balanceAvailableAt}
    />
  )
}
