import { requireApiPermission, resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireApiPermission('media.view')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const kind = new URL(request.url).searchParams.get('kind')
  const supabase = getSupabaseServerClient()

  if (kind === 'packages') {
    const { data, error } = await supabase
      .from('packages')
      .select('id, package_key, package_name, label_pt, label_en, label_es, image_url, display_order')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('display_order', { ascending: true })
    if (error) return Response.json({ error: error.message, items: [] }, { status: 500 })
    return Response.json({
      items: (data ?? []).map((row) => ({
        id: row.id,
        name: row.label_pt || row.package_name || row.package_key,
        imageUrl: row.image_url,
        kind: 'package',
      })),
    })
  }

  const { data, error } = await supabase
    .from('catalog_items')
    .select('id, item_key, item_name, label_pt, label_en, label_es, image_url, display_order, can_be_additional')
    .eq('company_id', companyId)
    .eq('active', true)
    .eq('can_be_additional', true)
    .order('display_order', { ascending: true })
  if (error) return Response.json({ error: error.message, items: [] }, { status: 500 })
  return Response.json({
    items: (data ?? []).map((row) => ({
      id: row.id,
      name: row.label_pt || row.item_name || row.item_key,
      imageUrl: row.image_url,
      kind: 'additional',
    })),
  })
}
