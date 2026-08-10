import { SIDES_ITEMS } from '@/Lib/cdlCommercialRules'
import {
  getCustomerDisplayName,
  type CustomerNameSource,
} from '@/Lib/getCustomerDisplayName'
import {
  formatPackageSideItemsText,
  type PackageSideItem,
} from '@/Lib/packageConfiguration'
import {
  SUPPLIER_GARNISH_KIT_RULE_KEY,
  parseSupplierGarnishKitConfig,
  type SupplierGarnishKitConfig,
} from '@/Lib/supplierGarnishKitRule'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { CATALOG_ITEMS_TABLE } from '@/Lib/catalogItemsTableSchema'

export type ServiceOrderDetail = {
  id: string
  company_id: string
  service_order_number: string
  quote_id: string
  quote_number: string | null
  quote_version_id: string
  event_id: string | null
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  status: string
  event_date: string | null
  start_time: string | null
  end_time: string | null
  venue_name: string | null
  address_line: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  physical_guest_count: number | null
  billable_guest_count: number | null
  /** Adultos (snapshot da cotação) — base HH/HI do kit CDL. */
  adult_count: number | null
  currency_code: string
  package_total: number
  additional_total: number
  mileage_fee: number
  discount_amount: number
  reservation_amount: number
  balance_due: number
  service_order_total: number
  commercial_snapshot: Record<string, unknown>
  notes: string | null
  cancel_reason: string | null
  cancelled_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  items: Array<{
    id: string
    item_type: string
    item_key: string | null
    label_pt: string
    quantity: number | null
    unit_price: number | null
    total_price: number | null
    display_order: number
  }>
  checklist: Array<{
    id: string
    title: string
    category: string
    is_required: boolean
    status: string
    display_order: number
    completed_by: string | null
    completed_at: string | null
  }>
  status_history: Array<{
    id: string
    from_status: string | null
    to_status: string
    reason: string | null
    changed_by: string | null
    created_at: string
  }>
  agenda_event: {
    id: string
    team_id: string | null
    event_date: string
    start_time: string
    end_time: string
    status: string
  } | null
  /** Nome da equipe designada (agenda). */
  team_name: string | null
  /** Guarnições do pacote / adicionais SIDE para pedido ao fornecedor. */
  garnish_items: string[]
  package_key: string | null
  package_label: string | null
  /** Pacote com guarnição inclusa (chave …+) ou itens SIDE. */
  has_garnish_order: boolean
  /**
   * Packing HC–HK da empresa (commercial_rules.supplier_garnish_kit_packing).
   * null = empresa sem regra → não aplica modelo CDL.
   */
  supplier_garnish_kit_config: SupplierGarnishKitConfig | null
}

export async function fetchServiceOrderDetail(
  companyId: string,
  serviceOrderId: string,
): Promise<{ data: ServiceOrderDetail | null; error: { message: string; status?: number } | null }> {
  const supabase = getSupabaseServerClient()

  const { data: order, error } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', serviceOrderId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return { data: null, error: { message: error.message, status: 500 } }
  if (!order) return { data: null, error: { message: 'Ordem de Serviço não encontrada.', status: 404 } }

  const [
    quoteRes,
    customerRes,
    itemsRes,
    checklistRes,
    historyRes,
    agendaRes,
    kitRuleRes,
  ] = await Promise.all([
      supabase.from('quotes').select('quote_number').eq('id', order.quote_id).maybeSingle(),
      order.customer_id
        ? supabase
            .from('customers')
            .select('ab_name, full_name, contact_name, company_name, phone, email')
            .eq('id', order.customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('service_order_items')
        .select('*')
        .eq('service_order_id', serviceOrderId)
        .order('display_order', { ascending: true }),
      supabase
        .from('service_order_checklist_items')
        .select('*')
        .eq('service_order_id', serviceOrderId)
        .order('display_order', { ascending: true }),
      supabase
        .from('service_order_status_history')
        .select('*')
        .eq('service_order_id', serviceOrderId)
        .order('created_at', { ascending: false }),
      supabase
        .from('agenda_events')
        .select('id, team_id, event_date, start_time, end_time, status')
        .eq('service_order_id', serviceOrderId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('commercial_rules')
        .select('rule_value, active')
        .eq('company_id', companyId)
        .eq('rule_key', SUPPLIER_GARNISH_KIT_RULE_KEY)
        .eq('active', true)
        .maybeSingle(),
    ])

  const kitRuleValue = (kitRuleRes.data as { rule_value?: unknown } | null)
    ?.rule_value
  const kitScalar =
    kitRuleValue &&
    typeof kitRuleValue === 'object' &&
    'value' in (kitRuleValue as object)
      ? (kitRuleValue as { value: unknown }).value
      : kitRuleValue
  const supplierGarnishKitConfig = parseSupplierGarnishKitConfig(kitScalar)

  const customer = customerRes.data as CustomerNameSource | null
  const snapshot = (order.commercial_snapshot ?? {}) as {
    package?: {
      id?: string | null
      total?: number | null
      label_pt?: string | null
      label?: string | null
      name?: string | null
      package_name?: string | null
    }
    guest_counts?: {
      adult_count?: number | null
      billable_guest_count?: number | null
    }
    additional_items?: Array<{
      additional_item_id?: string
      quantity?: number | null
      unit_price?: number | null
      total_price?: number | null
      label_pt?: string | null
      item_name?: string | null
      selected?: boolean
    }>
  }
  const packageId = snapshot.package?.id?.trim() || null
  const snapshotAdult = Number(snapshot.guest_counts?.adult_count ?? NaN)
  const adultCount =
    Number.isFinite(snapshotAdult) && snapshotAdult > 0
      ? Math.floor(snapshotAdult)
      : null

  let teamName: string | null = null
  const teamId = agendaRes.data?.team_id?.trim() || null
  if (teamId) {
    const { data: team } = await supabase
      .from('operational_teams')
      .select('name')
      .eq('id', teamId)
      .maybeSingle()
    teamName = (team?.name as string | null) ?? null
  }

  let packageKey: string | null = null
  let packageLabel: string | null = null
  const garnishItems: string[] = []

  if (packageId) {
    let pkgRes = await supabase
      .from('packages')
      .select('package_key, label_pt')
      .eq('id', packageId)
      .maybeSingle()
    if (pkgRes.error) {
      pkgRes = await supabase
        .from('packages')
        .select('package_key')
        .eq('id', packageId)
        .maybeSingle()
    }
    packageKey = (pkgRes.data?.package_key as string | null) ?? null
    packageLabel = (pkgRes.data?.label_pt as string | null) ?? null

    let sidesRes = await supabase
      .from('package_side_items')
      .select('package_id, item_key, label_pt, label_en, label_es, display_order, active')
      .eq('package_id', packageId)
      .order('display_order', { ascending: true })
    if (sidesRes.error) {
      sidesRes = { data: null, error: sidesRes.error } as typeof sidesRes
    }

    const sideRows = ((sidesRes.data ?? []) as PackageSideItem[]).filter(
      (row) => row.active !== false,
    )
    if (sideRows.length > 0) {
      const text = formatPackageSideItemsText(sideRows, 'pt')
      for (const part of text.split(/\s*[•·|,]\s*/)) {
        if (part.trim()) garnishItems.push(part.trim())
      }
    } else if ((packageKey ?? '').endsWith('+')) {
      garnishItems.push(...SIDES_ITEMS)
    }
  }

  const additionalIds = [
    ...new Set(
      (snapshot.additional_items ?? [])
        .map((row) => row.additional_item_id?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (additionalIds.length > 0) {
    const { data: catalogRows } = await supabase
      .from(CATALOG_ITEMS_TABLE)
      .select('id, label_pt, item_type, item_key')
      .in('id', additionalIds)
    const byId = new Map(
      (catalogRows ?? []).map((row) => [row.id as string, row]),
    )
    for (const add of snapshot.additional_items ?? []) {
      const id = add.additional_item_id?.trim()
      if (!id) continue
      const cat = byId.get(id)
      if (!cat) continue
      const type = String(cat.item_type ?? '').toUpperCase()
      const label = String(cat.label_pt ?? cat.item_key ?? '').trim()
      if (type !== 'SIDE' && !/guarni|side|arroz|feij|vinagrete|farofa|mandioca/i.test(label)) {
        continue
      }
      if (!label) continue
      const qty = Number(add.quantity ?? 0)
      const line =
        qty > 0 && qty !== 1 ? `${label} (×${qty})` : label
      if (!garnishItems.some((g) => g.toLowerCase() === label.toLowerCase())) {
        garnishItems.push(line)
      }
    }
  }

  const hasGarnishOrder =
    garnishItems.length > 0 || Boolean((packageKey ?? '').endsWith('+'))

  const data: ServiceOrderDetail = {
    id: order.id,
    company_id: order.company_id,
    service_order_number: order.service_order_number,
    quote_id: order.quote_id,
    quote_number: (quoteRes.data?.quote_number as string | null) ?? null,
    quote_version_id: order.quote_version_id,
    event_id: order.event_id,
    customer_id: order.customer_id,
    customer_name: getCustomerDisplayName(customer),
    customer_phone: customer?.phone ?? null,
    customer_email: customer?.email ?? null,
    status: order.status,
    event_date: order.event_date,
    start_time: order.start_time,
    end_time: order.end_time,
    venue_name: order.venue_name,
    address_line: order.address_line,
    city: order.city,
    state: order.state,
    postal_code: order.postal_code,
    physical_guest_count: order.physical_guest_count,
    billable_guest_count: order.billable_guest_count,
    adult_count: adultCount,
    currency_code: order.currency_code,
    package_total: Number(order.package_total ?? 0),
    additional_total: Number(order.additional_total ?? 0),
    mileage_fee: Number(order.mileage_fee ?? 0),
    discount_amount: Number(order.discount_amount ?? 0),
    reservation_amount: Number(order.reservation_amount ?? 0),
    balance_due: Number(order.balance_due ?? 0),
    service_order_total: Number(order.service_order_total ?? 0),
    commercial_snapshot: order.commercial_snapshot ?? {},
    notes: order.notes,
    cancel_reason: order.cancel_reason,
    cancelled_at: order.cancelled_at,
    completed_at: order.completed_at,
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: (() => {
      const fromTable = itemsRes.data ?? []
      if (fromTable.length > 0) return fromTable
      // Fallback: snapshot comercial (OS seed/legado sem service_order_items)
      const fallback: ServiceOrderDetail['items'] = []
      if (snapshot.package?.id) {
        fallback.push({
          id: `snap-package-${snapshot.package.id}`,
          item_type: 'package',
          item_key: snapshot.package.id,
          label_pt:
            snapshot.package.label_pt?.trim() ||
            snapshot.package.label?.trim() ||
            snapshot.package.package_name?.trim() ||
            snapshot.package.name?.trim() ||
            packageLabel ||
            'Pacote',
          quantity: snapshot.guest_counts?.billable_guest_count ?? null,
          unit_price: null,
          total_price: Number(snapshot.package.total ?? order.package_total ?? 0),
          display_order: 0,
        })
      }
      let i = 1
      for (const add of snapshot.additional_items ?? []) {
        if (!add.additional_item_id || add.selected === false) continue
        fallback.push({
          id: `snap-additional-${add.additional_item_id}`,
          item_type: 'additional',
          item_key: add.additional_item_id,
          label_pt: add.label_pt?.trim() || add.item_name?.trim() || 'Adicional',
          quantity: add.quantity ?? null,
          unit_price: add.unit_price ?? null,
          total_price: add.total_price ?? null,
          display_order: i++,
        })
      }
      return fallback
    })(),
    checklist: checklistRes.data ?? [],
    status_history: historyRes.data ?? [],
    agenda_event: agendaRes.data ?? null,
    team_name: teamName,
    garnish_items: garnishItems,
    package_key: packageKey,
    package_label: packageLabel,
    has_garnish_order: hasGarnishOrder,
    supplier_garnish_kit_config:
      supplierGarnishKitConfig?.enabled === true
        ? supplierGarnishKitConfig
        : null,
  }

  return { data, error: null }
}
