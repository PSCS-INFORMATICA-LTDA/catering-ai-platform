import { ImageResponse } from 'next/og'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { loadCompanyOgBrand } from '@/Lib/payments/loadPaymentOgBrand'
import {
  companyLogoStoragePath,
  isCompanyOgId,
  paymentOgDescription,
} from '@/Lib/payments/paymentOgCopy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIZE = { width: 1200, height: 630 }
const MAX_LOGO_BYTES = 1_500_000
const ALLOWED_LOGO_MIME = /^(image\/png|image\/jpeg|image\/jpg|image\/webp|image\/gif)/i

async function asDataUri(buffer: Buffer, mime: string): Promise<string | null> {
  if (!ALLOWED_LOGO_MIME.test(mime) || buffer.length > MAX_LOGO_BYTES) return null
  return `data:${mime};base64,${buffer.toString('base64')}`
}

async function loadLogoDataUri(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl) return null
  try {
    const storagePath = companyLogoStoragePath(logoUrl)
    if (storagePath) {
      const { data, error } = await getSupabaseServerClient()
        .storage.from('company-logos')
        .download(storagePath)
      if (error || !data) return null
      const buffer = Buffer.from(await data.arrayBuffer())
      return asDataUri(buffer, data.type || 'image/png')
    }
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\//i.test(logoUrl)) return null
    const response = await fetch(logoUrl, { cache: 'no-store' })
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    const mime = response.headers.get('content-type') || 'image/png'
    return asDataUri(buffer, mime)
  } catch {
    return null
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params
  const brand = isCompanyOgId(companyId)
    ? await loadCompanyOgBrand(companyId)
    : {
        companyId: null,
        displayName: 'Catering AI',
        logoUrl: null,
        locale: 'pt' as const,
        description: paymentOgDescription('pt'),
      }
  const logoSrc = await loadLogoDataUri(brand.logoUrl)
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
            // ImageResponse requires a raw img; next/image is not available here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt=""
              width={180}
              height={180}
              style={{
                width: 180,
                height: 180,
                objectFit: 'contain',
                borderRadius: 28,
                background: '#ffffff',
                padding: 16,
              }}
            />
          ) : (
            <div
              style={{
                width: 180,
                height: 180,
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
            <div
              style={{
                fontSize: 22,
                letterSpacing: 4,
                textTransform: 'uppercase',
                opacity: 0.7,
              }}
            >
              Catering AI
            </div>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, marginTop: 12 }}>
              {brand.displayName}
            </div>
            <div style={{ fontSize: 28, marginTop: 20, opacity: 0.85 }}>
              {brand.description}
            </div>
          </div>
        </div>
      </div>
    ),
    SIZE,
  )
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600')
  return response
}
