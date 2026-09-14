import { ImageResponse } from 'next/og'
import { loadCompanyOgBrand } from '@/Lib/payments/loadPaymentOgBrand'
import {
  isCompanyOgId,
  paymentOgDescription,
  resolveOgLogoSrc,
} from '@/Lib/payments/paymentOgCopy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIZE = { width: 1200, height: 630 }

function ogWords(text: string, fontSize: number, extra: Record<string, string | number> = {}) {
  const parts = String(text || '')
    .split(/\s+/)
    .filter(Boolean)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: Math.max(8, Math.round(fontSize * 0.28)),
        fontSize,
        ...extra,
      }}
    >
      {parts.map((word, index) => (
        <div key={`${index}-${word}`} style={{ display: 'flex' }}>
          {word}
        </div>
      ))}
    </div>
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params
  const origin = new URL(request.url).origin
  const brand = isCompanyOgId(companyId)
    ? await loadCompanyOgBrand(companyId)
    : {
        companyId: null,
        displayName: 'Catering AI',
        logoUrl: null,
        locale: 'pt' as const,
        description: paymentOgDescription('pt'),
      }
  const logoSrc = resolveOgLogoSrc(brand.logoUrl, origin)
  const initials =
    brand.displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() || '')
      .join('') || 'CA'

  const response = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px',
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 55%, #111827 100%)',
          color: '#f9fafb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          {logoSrc ? (
            <div
              style={{
                width: 196,
                height: 196,
                borderRadius: 28,
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
              }}
            >
              {/* ImageResponse requires a raw img; next/image is not available here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="" width={172} height={172} />
            </div>
          ) : (
            <div
              style={{
                width: 196,
                height: 196,
                borderRadius: 28,
                background: '#f59e0b',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 64,
                fontWeight: 800,
              }}
            >
              {initials}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 760 }}>
            {ogWords('Catering AI', 22, { opacity: 0.7 })}
            {ogWords(brand.displayName, 52, { fontWeight: 800, marginTop: 12 })}
            {ogWords(brand.description, 28, { marginTop: 20, opacity: 0.85 })}
          </div>
        </div>
      </div>
    ),
    SIZE,
  )
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600')
  return response
}
