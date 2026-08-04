import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
  type ApiAuthResult,
} from '@/Lib/auth/requireApi'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BUCKET = 'company-logos'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

async function requireCompanyEditor(): Promise<ApiAuthResult> {
  const primary = await requireApiPermission('company.settings')
  if (primary.ok) return primary
  return requireApiPermission('users.manage')
}

export async function POST(request: Request) {
  const auth = await requireCompanyEditor()
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'Arquivo obrigatório.' }, { status: 400 })
  }
  if (!ALLOWED.has(file.type.toLowerCase())) {
    return Response.json(
      { error: 'Use JPG, PNG ou WEBP (máx. 5 MB).' },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'O logo deve ter no máximo 5 MB.' }, { status: 400 })
  }

  const ext =
    file.type.includes('png')
      ? 'png'
      : file.type.includes('webp')
        ? 'webp'
        : 'jpg'
  const path = `${companyId}/logo-${Date.now()}.${ext}`
  const supabase = getSupabaseServerClient()

  const { data: current } = await supabase
    .from('companies')
    .select('logo_url')
    .eq('id', companyId)
    .maybeSingle()

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type || 'image/png',
      upsert: true,
      cacheControl: '3600',
    })

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const { data, error } = await supabase
    .from('companies')
    .update({
      logo_url: publicUrl,
      brand_logo_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId)
    .select('id, logo_url, brand_logo_url')
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // best-effort cleanup of previous object in same bucket
  const prev = current?.logo_url as string | undefined
  if (prev?.includes('/company-logos/')) {
    const marker = '/company-logos/'
    const idx = prev.indexOf(marker)
    if (idx >= 0) {
      const oldPath = decodeURIComponent(prev.slice(idx + marker.length))
      if (oldPath && oldPath !== path) {
        await supabase.storage.from(BUCKET).remove([oldPath]).catch(() => null)
      }
    }
  }

  return Response.json({ data: { ...data, logo_url: publicUrl } })
}

export async function DELETE() {
  const auth = await requireCompanyEditor()
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const supabase = getSupabaseServerClient()
  const { data: current } = await supabase
    .from('companies')
    .select('logo_url')
    .eq('id', companyId)
    .maybeSingle()

  const { error } = await supabase
    .from('companies')
    .update({
      logo_url: null,
      brand_logo_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const prev = current?.logo_url as string | undefined
  if (prev?.includes('/company-logos/')) {
    const marker = '/company-logos/'
    const idx = prev.indexOf(marker)
    if (idx >= 0) {
      const oldPath = decodeURIComponent(prev.slice(idx + marker.length))
      if (oldPath) {
        await supabase.storage.from(BUCKET).remove([oldPath]).catch(() => null)
      }
    }
  }

  return Response.json({ ok: true })
}
