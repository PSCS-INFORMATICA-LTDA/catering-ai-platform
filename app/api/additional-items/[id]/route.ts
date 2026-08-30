import { getCdlCompanyId } from '@/Lib/cdlCompany'
import { getAdditionalItemPrice } from '@/Lib/getAdditionalItemPrice'
import {
  buildCatalogItemsListSelect,
  CATALOG_ITEMS_TABLE,
  pickCatalogItemsUpdatePayload,
  type CatalogItemsInsertPayload,
} from '@/Lib/catalogItemsTableSchema'
import { supabase } from '@/Lib/supabase'
import { normalizeCatalogItemLabelFields } from '@/Lib/publicQuote/catalogDisplayName'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params

  let body: CatalogItemsInsertPayload & { active?: boolean }
  try {
    body = (await request.json()) as CatalogItemsInsertPayload & {
      active?: boolean
    }
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const isDeactivateOnly =
    Object.keys(body).length === 1 && body.active === false

  const updatePayload: Record<string, unknown> = isDeactivateOnly
    ? { active: false, updated_at: new Date().toISOString() }
    : {
        ...pickCatalogItemsUpdatePayload(normalizeCatalogItemLabelFields(body)),
        ...(body.price != null || body.sale_price != null
          ? {
              price: getAdditionalItemPrice(body),
              sale_price: getAdditionalItemPrice(body),
            }
          : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        updated_at: new Date().toISOString(),
      }

  const companyId = getCdlCompanyId()
  let query = supabase
    .from(CATALOG_ITEMS_TABLE)
    .update(updatePayload)
    .eq('id', id)

  if (companyId?.trim()) {
    query = query.or(`company_id.eq.${companyId},company_id.is.null`)
  }

  const { data, error } = await query.select('id').maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!data?.id) {
    return Response.json({ error: 'Item não encontrado.' }, { status: 404 })
  }

  return Response.json({ id: data.id })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const companyId = getCdlCompanyId()

  let query = supabase
    .from(CATALOG_ITEMS_TABLE)
    .select(buildCatalogItemsListSelect())
    .eq('id', id)

  if (companyId?.trim()) {
    query = query.or(`company_id.eq.${companyId},company_id.is.null`)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return Response.json({ error: 'Item não encontrado.' }, { status: 404 })
  }

  return Response.json({ data })
}
