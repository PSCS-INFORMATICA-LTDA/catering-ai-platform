import type { QuoteDetail, QuoteAdditionalItem } from '@/app/quotes/[id]/quoteDetailTypes'
import { enrichQuoteAdditionalsFromCatalog } from '@/Lib/catalogItemVisual'
import {
  buildCatalogItemsListSelect,
  CATALOG_ITEMS_TABLE,
} from '@/Lib/catalogItemsTableSchema'
import { fetchQuoteLinkedPackageCatalog } from '@/Lib/fetchQuoteLinkedPackageCatalog'
import { fetchPackageOptionGroups, fetchQuotePackageSelections } from '@/Lib/fetchPackageOptionGroups'
import type { CustomerNameSource } from '@/Lib/getCustomerDisplayName'
import type { CatalogItemListItem } from '@/Lib/itemCatalog'
import {
  buildPackageSelectionLabels,
  packageSelectionsFromRows,
} from '@/Lib/packageOptionGroups'
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

const PROPOSAL_COLUMNS =
  'proposal_token, proposal_sent_at, proposal_response, proposal_accepted_at, proposal_rejected_at, proposal_follow_up_count, proposal_last_follow_up_at'

const ORDER_COLUMNS = 'accepted_version_id, converted_service_order_id'

/** Colunas comerciais que a quote_detail_view pode não expor ainda. */
const COMMERCIAL_COLUMNS =
  'holiday_surcharge_amount, minimum_order_amount, minimum_order_applied, reservation_confirmed_at, reservation_confirmed_by, package_total, additional_total, grill_rental_total, grill_rental_required, grill_rental_qty, discount_amount, mileage_base_location, mileage_distance, mileage_free_limit, mileage_rate, mileage_fee, quote_total, reservation_amount, balance_due, reservation_percentage'

const QUOTE_TABLE_COLUMNS = [
  OFFICIAL_GUEST_COLUMNS,
  PROPOSAL_COLUMNS,
  ORDER_COLUMNS,
  COMMERCIAL_COLUMNS,
  'pricing_breakdown',
].join(', ')

async function loadQuoteTableExtras(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  id: string,
  companyId: string,
) {
  const combined = await supabase
    .from('quotes')
    .select(QUOTE_TABLE_COLUMNS)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!combined.error && combined.data) {
    return combined.data as unknown as Record<string, unknown>
  }

  if (combined.error && !/column/i.test(combined.error.message)) {
    console.error(
      `[CDL Quote] Failed to load quote extras for ${id}:`,
      combined.error.message,
    )
  }

  const [guestRes, proposalRes, orderRes, commercialRes, breakdownRes] =
    await Promise.all([
      supabase
        .from('quotes')
        .select(OFFICIAL_GUEST_COLUMNS)
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase
        .from('quotes')
        .select(PROPOSAL_COLUMNS)
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase
        .from('quotes')
        .select(ORDER_COLUMNS)
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase
        .from('quotes')
        .select(COMMERCIAL_COLUMNS)
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase
        .from('quotes')
        .select('pricing_breakdown')
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle(),
    ])

  return {
    ...(guestRes.data ?? {}),
    ...(proposalRes.data && !proposalRes.error ? proposalRes.data : {}),
    ...(orderRes.data && !orderRes.error ? orderRes.data : {}),
    ...(commercialRes.data && !commercialRes.error ? commercialRes.data : {}),
    ...(breakdownRes.data && !breakdownRes.error ? breakdownRes.data : {}),
  } as Record<string, unknown>
}

export async function fetchQuoteDetail(
  id: string,
  displayLanguage?: string | null,
) {
  const startedAt = Date.now()
  const companyId = getActiveCompanyId()
  const supabase = getSupabaseServerClient()

  const [viewRes, quoteExtras] = await Promise.all([
    supabase
      .from('quote_detail_view')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single(),
    loadQuoteTableExtras(supabase, id, companyId),
  ])

  if (viewRes.error) {
    return { data: null as QuoteDetail | null, error: viewRes.error }
  }

  const quote = normalizeQuoteDetailRow({
    ...(viewRes.data as Record<string, unknown>),
    ...quoteExtras,
  })

  const additionalItems = quote.additional_items ?? []
  const catalogIds = [
    ...new Set(
      additionalItems
        .map((row) => row.item_id?.trim())
        .filter((itemId): itemId is string => Boolean(itemId)),
    ),
  ]

  const [packageCatalog, selectionsRes, catalogRes] = await Promise.all([
    fetchQuoteLinkedPackageCatalog({
      packageId: quote.package_id,
      packageKey: quote.package_key,
      companyId,
    }),
    fetchQuotePackageSelections(id),
    catalogIds.length > 0
      ? supabase
          .from(CATALOG_ITEMS_TABLE)
          .select(buildCatalogItemsListSelect())
          .in('id', catalogIds)
      : Promise.resolve({ data: null, error: null }),
  ])

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

  if (!catalogRes.error && catalogRes.data?.length) {
    data = {
      ...data,
      additional_items: enrichQuoteAdditionalsFromCatalog(
        additionalItems as QuoteAdditionalItem[],
        catalogRes.data as unknown as CatalogItemListItem[],
      ),
    }
  }

  const packageId = data.package_id?.trim() || null
  if (!selectionsRes.error && (selectionsRes.data?.length ?? 0) > 0) {
    const selectionRows = selectionsRes.data ?? []
    data = {
      ...data,
      package_selections: selectionRows.map((row) => ({
        option_group_id: row.option_group_id,
        option_item_id: row.option_item_id,
        package_id: row.package_id,
      })),
    }

    if (packageId) {
      const groupsRes = await fetchPackageOptionGroups({ packageId })
      if (!groupsRes.error && groupsRes.data?.length) {
        const lang =
          displayLanguage === 'en' ||
          displayLanguage === 'es' ||
          displayLanguage === 'pt'
            ? displayLanguage
            : data.language === 'en' || data.language === 'es'
              ? data.language
              : 'pt'
        data = {
          ...data,
          package_selection_labels: buildPackageSelectionLabels(
            packageSelectionsFromRows(selectionRows),
            groupsRes.data,
            lang,
          ),
        }
      }
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[quote-detail-timing]', {
      quoteId: id,
      ms: Date.now() - startedAt,
    })
  }

  return { data, error: null }
}
