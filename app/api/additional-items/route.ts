import { rejectSpoofedCompanyId, requireApiPermission } from '@/Lib/auth/requireApi'
import { getCdlCompanyId } from '@/Lib/cdlCompany'
import { fetchCatalogItems } from '@/Lib/fetchCatalogItems'
import { getCatalogItemSalePrice } from '@/Lib/getAdditionalItemPrice'
import {
  CATALOG_ITEMS_TABLE,
  pickCatalogItemsInsertPayload,
  type CatalogItemsInsertPayload,
} from '@/Lib/catalogItemsTableSchema'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { normalizeCatalogItemLabelFields } from '@/Lib/publicQuote/catalogDisplayName'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function itemMatchesSearch(
  item: {
    item_key?: string | null
    item_name?: string | null
    label_pt?: string | null
    category_pt?: string | null
  },
  query: string,
) {
  const haystack = [
    item.item_key,
    item.item_name,
    item.label_pt,
    item.category_pt,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

export async function GET(request: Request) {
  const auth = await requireApiPermission('catalog.view')
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim() ?? ''
  const activeFilter = url.searchParams.get('active')
  const category = url.searchParams.get('category')?.trim() ?? ''

  const usageParam = url.searchParams.get('usage')?.trim() as
    | 'package_item'
    | 'side_item'
    | 'additional'
    | 'option_choice'
    | 'inventory'
    | ''
    | undefined
  const audienceParam = url.searchParams.get('audience')?.trim()
  const audience =
    audienceParam === 'customer' ? ('customer' as const) : ('admin' as const)

  const { data, error } = await fetchCatalogItems({
    includeInactive: activeFilter === 'all',
    activeOnly: activeFilter === 'true',
    audience,
    usage:
      usageParam === 'package_item' ||
      usageParam === 'side_item' ||
      usageParam === 'additional' ||
      usageParam === 'option_choice' ||
      usageParam === 'inventory'
        ? usageParam
        : undefined,
  })

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? 'Não foi possível buscar o catálogo de itens.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  let result = data
  if (query) {
    result = result.filter((item) => itemMatchesSearch(item, query))
  }
  if (category) {
    result = result.filter(
      (item) => (item.category_pt ?? '').toLowerCase() === category.toLowerCase(),
    )
  }

  return Response.json(
    { data: result },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  )
}

export async function POST(request: Request) {
  const auth = await requireApiPermission('catalog.manage')
  if (!auth.ok) return auth.response

  const companyId = getCdlCompanyId()
  if (!companyId?.trim()) {
    return Response.json({ error: 'company_id não configurado.' }, { status: 500 })
  }

  let body: CatalogItemsInsertPayload
  try {
    body = (await request.json()) as CatalogItemsInsertPayload
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const spoof = rejectSpoofedCompanyId(auth.session, (body as { company_id?: string }).company_id)
  if (spoof) return spoof

  if (!body.item_key?.toString().trim()) {
    return Response.json({ error: 'item_key é obrigatório.' }, { status: 400 })
  }
  if (!body.item_name?.toString().trim()) {
    return Response.json({ error: 'item_name é obrigatório.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const salePrice = getCatalogItemSalePrice(body)
  const payload = {
    ...pickCatalogItemsInsertPayload(normalizeCatalogItemLabelFields(body)),
    company_id: companyId,
    price: salePrice,
    sale_price: salePrice,
    active: body.active !== false,
    display_order: Number(body.display_order) || 0,
    customer_visible: body.customer_visible !== false,
    item_type: String(body.item_type ?? 'PRODUCT').trim() || 'PRODUCT',
    operational_item: body.operational_item === true,
    can_be_package_item: body.can_be_package_item !== false,
    can_be_side_item: body.can_be_side_item === true,
    can_be_additional: body.can_be_additional !== false,
    can_be_option_choice: body.can_be_option_choice !== false,
    inventory_enabled: body.inventory_enabled === true,
    cost_price: Number(body.cost_price) || 0,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await getSupabaseServerClient()
    .from(CATALOG_ITEMS_TABLE)
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ id: data?.id }, { status: 201 })
}
