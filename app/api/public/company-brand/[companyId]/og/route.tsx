import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { loadCompanyOgBrand } from '@/Lib/payments/loadPaymentOgBrand'
import {
  companyLogoStoragePath,
  isAppPublicLogoPath,
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

function mimeFromPath(path: string): string {
  if (/\.webp$/i.test(path)) return 'image/webp'
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg'
  if (/\.gif$/i.test(path)) return 'image/gif'
  return 'image/png'
}

function ogWords(text: string, fontSize: number, extra: Record<string, string | number> = {}) {
  const parts = String(text || '')
    .split(/\s+/)
    .filter(Boolean)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', fontSize, ...extra }}>
      {parts.map((word, index) => (
        <span
          key={`${index}-${word}`}
          style={{ marginRight: index === parts.length - 1 ? 0 : Math.round(fontSize * 0.22) }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}

async function loadLogoDataUri(
  logoUrl: string | null,
  requestOrigin: string,
): Promise<string | null> {
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
    if (isAppPublicLogoPath(logoUrl)) {
      try {
        const filePath = join(process.cwd(), 'public', logoUrl.replace(/^\//, ''))
        const buffer = await readFile(filePath)
        return asDataUri(buffer, mimeFromPath(filePath))
      } catch {
        const response = await fetch(`${requestOrigin}${logoUrl}`, { cache: 'no-store' })
        if (!response.ok) return null
        const buffer = Buffer.from(await response.arrayBuffer())
        const mime = response.headers.get('content-type') || mimeFromPath(logoUrl)
        return asDataUri(buffer, mime)
      }
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
  request: Request,
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
  const logoSrc = await loadLogoDataUri(brand.logoUrl, new URL(request.url).origin)
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
            {ogWords('Catering AI', 22, {
              letterSpacing: 4,
              textTransform: 'uppercase',
              opacity: 0.7,
            })}
            {ogWords(brand.displayName, 58, {
              fontWeight: 800,
              lineHeight: 1.1,
              marginTop: 12,
            })}
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
