import { getCdlCompanyId } from '@/Lib/cdlCompany'
import { fetchPackages } from '@/Lib/fetchPackages'
import {
  pickPackagesInsertPayload,
  type PackagesInsertPayload,
} from '@/Lib/packagesTableSchema'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function packageMatchesSearch(
  pkg: {
    package_name?: string | null
    package_key?: string | null
    label_pt?: string | null
    label_en?: string | null
    label_es?: string | null
  },
  query: string,
) {
  const haystack = [
    pkg.package_name,
    pkg.package_key,
    pkg.label_pt,
    pkg.label_en,
    pkg.label_es,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim() ?? ''
  const activeFilter = url.searchParams.get('active')

  const { data, error } = await fetchPackages({
    includeInactive: activeFilter === 'all',
    activeOnly: activeFilter === 'true',
  })

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? 'Não foi possível buscar pacotes.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  let result = data
  if (query) {
    result = data.filter((pkg) => packageMatchesSearch(pkg, query))
  }

  return Response.json(
    { data: result },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  )
}

export async function POST(request: Request) {
  const companyId = getCdlCompanyId()
  if (!companyId?.trim()) {
    return Response.json({ error: 'company_id não configurado.' }, { status: 500 })
  }

  let body: PackagesInsertPayload
  try {
    body = (await request.json()) as PackagesInsertPayload
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  if (!body.package_key?.toString().trim()) {
    return Response.json({ error: 'package_key é obrigatório.' }, { status: 400 })
  }
  if (!body.label_pt?.toString().trim()) {
    return Response.json({ error: 'label_pt é obrigatório.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const payload = {
    ...pickPackagesInsertPayload(body),
    company_id: companyId,
    package_name: body.package_name?.toString().trim() || body.label_pt?.toString().trim(),
    active: body.active !== false,
    currency_code: body.currency_code?.toString().trim() || 'USD',
    display_order: Number(body.display_order) || 0,
    price_per_person: Number(body.price_per_person) || 0,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await getSupabaseServerClient()
    .from('packages')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ id: data?.id }, { status: 201 })
}
