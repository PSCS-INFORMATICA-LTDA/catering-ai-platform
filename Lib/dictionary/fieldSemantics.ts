import type { FieldSemantics } from './types.ts'

const NOT_FINANCIAL = new Set([
  'total_guests',
  'physical_guest_count',
  'billable_guest_count',
  'adults_count',
  'children_count',
  'adult_count',
  'children_under_3_count',
  'children_4_to_12_count',
  'billable_guests',
])

const SENSITIVE_EXACT = new Set([
  'email',
  'billing_email',
  'phone',
  'phone_normalized',
  'password',
  'document',
  'tax_id',
  'state_registration',
  'internal_notes',
  'token',
  'token_hash',
  'google_calendar_id',
  'google_calendar_event_id',
  'auth_user_id',
])

const TRANSLATABLE_EXACT = new Set([
  'label_pt',
  'label_en',
  'label_es',
  'package_name_pt',
  'package_name_en',
  'package_name_es',
  'unit_label_pt',
  'unit_label_en',
  'unit_label_es',
])

const KEY_DESCRIPTIONS: Record<
  string,
  { pt: string; en: string; es: string }
> = {
  id: {
    pt: 'Identificador único.',
    en: 'Unique identifier.',
    es: 'Identificador único.',
  },
  company_id: {
    pt: 'Empresa dona do registro (tenant).',
    en: 'Owning company (tenant).',
    es: 'Empresa dueña del registro (tenant).',
  },
  language: {
    pt: 'Idioma do documento (proposta/PDF). Independente da UI.',
    en: 'Document language (proposal/PDF). Independent from UI locale.',
    es: 'Idioma del documento (propuesta/PDF). Independiente de la UI.',
  },
  preferred_language: {
    pt: 'Idioma preferido da pessoa/usuário (UI ou contato).',
    en: 'Preferred language of the person/user (UI or contact).',
    es: 'Idioma preferido de la persona/usuario (UI o contacto).',
  },
  quote_total: {
    pt: 'Total da cotação.',
    en: 'Quote total.',
    es: 'Total de la cotización.',
  },
  service_order_total: {
    pt: 'Total da Ordem de Serviço (snapshot).',
    en: 'Service order total (snapshot).',
    es: 'Total de la orden de servicio (snapshot).',
  },
}

function isFinancialColumn(column: string): boolean {
  if (NOT_FINANCIAL.has(column)) return false
  return (
    /(^|_)(price|subtotal|discount|cost|margin|markup|deposit|fee|balance)(_|$)/i.test(
      column,
    ) ||
    /(_amount|_total)$/i.test(column) ||
    /^(sale_price|cost_price|unit_price|total_price|quote_total|package_total|additional_total|garnish_total|mileage_rate|mileage_fee|reservation_percentage)$/i.test(
      column,
    )
  )
}

function isSensitiveColumn(column: string): boolean {
  if (SENSITIVE_EXACT.has(column)) return true
  return /(password|token_hash|secret)/i.test(column)
}

function isTranslatableColumn(column: string): boolean {
  if (TRANSLATABLE_EXACT.has(column)) return true
  return /_pt$|_en$|_es$/.test(column) && column.startsWith('label')
}

/**
 * Metadata semântica (PSCS). Tipos/tamanho vêm do schema real.
 * Não inventa max_length.
 */
export function fieldSemantics(
  _entityCode: string,
  column: string,
): FieldSemantics {
  const desc = KEY_DESCRIPTIONS[column]
  return {
    description_pt: desc?.pt ?? null,
    description_en: desc?.en ?? null,
    description_es: desc?.es ?? null,
    sensitive: isSensitiveColumn(column),
    financial: isFinancialColumn(column),
    translatable: isTranslatableColumn(column),
    integration_name: column,
    notes: null,
  }
}

export function toApiName(column: string): string {
  return column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}
