import { getCatalogItemImageUrl } from '@/Lib/catalogItemVisual'
import { resolveCatalogItemDisplayLabel } from '@/Lib/cdlPackageItemI18n'
import type { PackageCatalogRecord } from '@/Lib/packageCatalogVisual'

export type QuoteAdditionalItem = {
  item_id: string
  item_key?: string
  label_pt?: string
  label_en?: string
  label_es?: string
  category_pt?: string
  category_en?: string
  category_es?: string
  quantity?: number | null
  unit_price?: number | null
  total_price?: number | null
  image_url?: string | null
  image_status?: string | null
  item_type?: string | null
}

export type QuoteDetailPackageCatalogRow = PackageCatalogRecord & {
  id?: string
  description_pt?: string | null
  description_en?: string | null
  description_es?: string | null
}

export type QuoteDetail = {
  id: string
  quote_number?: string | null
  quote_status?: string | null
  created_at?: string | null
  language?: string | null
  customer_id?: string | null
  package_id?: string | null
  package_key?: string | null
  ab_name?: string | null
  full_name?: string | null
  contact_name?: string | null
  company_name?: string | null
  email?: string | null
  phone?: string | null
  adult_count?: number | null
  children_under_3_count?: number | null
  children_4_to_12_count?: number | null
  physical_guest_count?: number | null
  billable_guest_count?: number | null
  package_name_pt?: string | null
  package_name_en?: string | null
  package_name_es?: string | null
  package_description_pt?: string | null
  package_description_en?: string | null
  package_description_es?: string | null
  package_description?: string | null
  package_unit_price?: number | null
  package_price_per_person?: number | null
  package_image_url?: string | null
  event_name?: string | null
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  venue_name?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  postal_code?: string | null
  has_grill?: boolean | null
  grill_photo_required?: boolean | null
  grill_photo_url?: string | null
  grill_photo_media_id?: string | null
  grill_rental_required?: boolean | null
  grill_rental_qty?: number | null
  grill_rental_total?: number | null
  grill_notes?: string | null
  grill_masters_qty?: number | null
  assistants_qty?: number | null
  mileage_base_location?: string | null
  mileage_distance?: number | null
  mileage_free_limit?: number | null
  mileage_rate?: number | null
  mileage_fee?: number | null
  package_total?: number | null
  additional_total?: number | null
  discount?: number | null
  discount_amount?: number | null
  reservation_amount?: number | null
  reservation_percentage?: number | null
  balance_due?: number | null
  quote_total?: number | null
  minimum_order_amount?: number | null
  minimum_order_applied?: boolean | null
  holiday_surcharge_amount?: number | null
  reservation_confirmed_at?: string | null
  reservation_confirmed_by?: string | null
  currency_code?: string | null
  proposal_token?: string | null
  proposal_sent_at?: string | null
  proposal_response?: string | null
  proposal_accepted_at?: string | null
  proposal_rejected_at?: string | null
  proposal_follow_up_count?: number | null
  proposal_last_follow_up_at?: string | null
  team_presentation_time?: string | null
  designated_team_id?: string | null
  accepted_version_id?: string | null
  converted_service_order_id?: string | null
  additional_items?: QuoteAdditionalItem[] | null
  package_selections?: Array<{
    option_group_id: string
    option_item_id: string
    package_id?: string | null
  }> | null
  /** Labels resolvidos das escolhas inclusas (não persistido). */
  package_selection_labels?: Array<{
    groupId: string
    groupTitle: string
    itemId: string
    itemLabel: string
  }> | null
  /** Pacote(s) carregados do Supabase para revisão pública (não persistido). */
  packageCatalogPackages?: QuoteDetailPackageCatalogRow[] | null
}

export function formatCurrency(value: number | null | undefined) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

export function formatDate(
  value: string | null | undefined,
  locale: string | null | undefined = 'pt',
) {
  if (!value) return '—'
  const normalized = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return '—'
  const bcp =
    locale === 'en' ? 'en-US' : locale === 'es' ? 'es' : 'pt-BR'
  return date.toLocaleDateString(bcp, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  const parts = value.split(':')
  if (parts.length < 2) return value
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
}

export function formatBool(
  value: boolean | null | undefined,
  locale: string | null | undefined = 'pt',
) {
  if (value === null || value === undefined) return '—'
  if (locale === 'en') return value ? 'Yes' : 'No'
  if (locale === 'es') return value ? 'Sí' : 'No'
  return value ? 'Sim' : 'Não'
}

export function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

export function getAdditionalLabel(
  item: QuoteAdditionalItem,
  language: string,
) {
  return (
    resolveCatalogItemDisplayLabel(
      {
        pt: item.label_pt,
        en: item.label_en,
        es: item.label_es,
      },
      language,
    ) || '—'
  )
}

export function getAdditionalCategory(
  item: QuoteAdditionalItem,
  language: string,
) {
  if (language === 'en') return item.category_en ?? item.category_pt ?? 'Outros'
  if (language === 'es') return item.category_es ?? item.category_pt ?? 'Outros'
  return item.category_pt ?? 'Outros'
}

export function getPackageName(
  quote: QuoteDetail,
  language?: string | null,
) {
  const lang = language ?? quote.language ?? 'pt'
  if (lang === 'en') return quote.package_name_en ?? quote.package_name_pt
  if (lang === 'es') return quote.package_name_es ?? quote.package_name_pt
  return quote.package_name_pt
}

export function getPackageDescription(
  quote: QuoteDetail,
  language?: string | null,
) {
  if (quote.package_description) return quote.package_description
  const lang = language ?? quote.language ?? 'pt'
  if (lang === 'en') return quote.package_description_en
  if (lang === 'es') return quote.package_description_es
  return quote.package_description_pt
}

export function getChargedMiles(quote: QuoteDetail) {
  const distance = Number(quote.mileage_distance ?? 0)
  const freeLimit = Number(quote.mileage_free_limit ?? 0)
  return Math.max(0, distance - freeLimit)
}

export function getDiscount(quote: QuoteDetail) {
  if (quote.discount_amount != null) return quote.discount_amount
  return quote.discount ?? 0
}

export function getZipCode(quote: QuoteDetail) {
  return quote.zip_code ?? quote.postal_code ?? null
}

export function getAdditionalImage(item: QuoteAdditionalItem) {
  if (item.image_status === 'missing') return null
  return getCatalogItemImageUrl(item)
}

export function groupAdditionalsByCategory(
  items: QuoteAdditionalItem[],
  language: string,
) {
  const groups = new Map<string, QuoteAdditionalItem[]>()

  for (const item of items) {
    const category = getAdditionalCategory(item, language)
    const list = groups.get(category) ?? []
    list.push(item)
    groups.set(category, list)
  }

  return Array.from(groups.entries()).map(([category, categoryItems]) => ({
    category,
    items: categoryItems,
  }))
}
