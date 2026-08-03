import type { QuoteDetail, QuoteAdditionalItem } from '@/app/quotes/[id]/quoteDetailTypes'
import { enrichQuoteAdditionalsFromCatalog } from '@/Lib/catalogItemVisual'
import {
  buildCatalogItemsListSelect,
  CATALOG_ITEMS_TABLE,
} from '@/Lib/catalogItemsTableSchema'
import { fetchQuoteLinkedPackageCatalog } from '@/Lib/fetchQuoteLinkedPackageCatalog'
import type { CustomerNameSource } from '@/Lib/getCustomerDisplayName'
import type { CatalogItemListItem } from '@/Lib/itemCatalog'
import { getActiveCompanyId } from '@/Lib/tenant/resolveTenant'
import { getSupabaseServerClient } from './supabaseServer'

function normalizeQuoteDetailRow(
  raw: Record<string, unknown>,
): QuoteDetail {
  const viewDisplayName = raw.customer_display_name
  const viewCustomerLabel = raw.customer_name
  const displayFromView =
    (typeof viewDisplayName === 'string' ? viewDisplayName : null) ??
    (typeof viewCustomerLabel === 'string' ? viewCustomerLabel : null)
  const customerFields: CustomerNameSource = {
    ab_name:
      (raw.ab_name as string | null | undefined) ?? displayFromView,
    full_name: raw.full_name as string | null | undefined,
    contact_name: raw.contact_name as string | null | undefined,
    company_name: raw.company_name as string | null | undefined,
    email:
      (raw.email as string | null | undefined) ??
      (raw.customer_email as string | null | undefined),
    phone:
      (raw.phone as string | null | undefined) ??
      (raw.customer_phone as string | null | undefined),
  }

  const {
    customer_name: _legacyViewAlias,
    customer_display_name: _viewDisplayAlias,
    ...rest
  } = raw

  return {
    ...rest,
    ...customerFields,
  } as QuoteDetail
}

const OFFICIAL_GUEST_COLUMNS =
  'adult_count, children_under_3_count, children_4_to_12_count, physical_guest_count, billable_guest_count'

export async function fetchQuoteDetail(id: string) {
  const companyId = getActiveCompanyId()
  const supabase = getSupabaseServerClient()

  const [viewRes, guestRes] = await Promise.all([
    supabase
      .from('quote_detail_view')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single(),
    supabase
      .from('quotes')
      .select(OFFICIAL_GUEST_COLUMNS)
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle(),
  ])

  if (viewRes.error) {
    return { data: null as QuoteDetail | null, error: viewRes.error }
  }

  if (guestRes.error) {
    console.error(
      `[CDL Quote] Failed to load official guest fields for quote ${id}:`,
      guestRes.error.message,
    )
  }

  const quote = normalizeQuoteDetailRow({
    ...(viewRes.data as Record<string, unknown>),
    ...(guestRes.data ?? {}),
  })

  const packageCatalog = await fetchQuoteLinkedPackageCatalog({
    packageId: quote.package_id,
    packageKey: quote.package_key,
  })

  const linkedPackage = packageCatalog.linkedPackage

  let data: QuoteDetail = {
    ...quote,
    package_key: quote.package_key ?? linkedPackage?.package_key ?? null,
    package_name_pt:
      quote.package_name_pt ??
      linkedPackage?.label_pt ??
      linkedPackage?.package_name ??
      null,
    package_name_en: quote.package_name_en ?? linkedPackage?.label_en ?? null,
    package_name_es: quote.package_name_es ?? linkedPackage?.label_es ?? null,
    package_description_pt:
      quote.package_description_pt ?? linkedPackage?.description_pt ?? null,
    package_description_en:
      quote.package_description_en ?? linkedPackage?.description_en ?? null,
    package_description_es:
      quote.package_description_es ?? linkedPackage?.description_es ?? null,
    package_price_per_person:
      quote.package_price_per_person ??
      quote.package_unit_price ??
      linkedPackage?.price_per_person ??
      null,
    package_image_url:
      quote.package_image_url?.trim() ||
      packageCatalog.resolvedImageUrl ||
      linkedPackage?.image_url?.trim() ||
      null,
    packageCatalogPackages: packageCatalog.catalogPackages,
  }

  const additionalItems = data.additional_items ?? []
  if (additionalItems.length > 0) {
    const catalogIds = [
      ...new Set(
        additionalItems
          .map((row) => row.item_id?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    if (catalogIds.length > 0) {
      const catalogRes = await supabase
        .from(CATALOG_ITEMS_TABLE)
        .select(buildCatalogItemsListSelect())
        .in('id', catalogIds)

      if (!catalogRes.error && catalogRes.data?.length) {
        data = {
          ...data,
          additional_items: enrichQuoteAdditionalsFromCatalog(
            additionalItems as QuoteAdditionalItem[],
            catalogRes.data as unknown as CatalogItemListItem[],
          ),
        }
      }
    }
  }

  return { data, error: null }
}
