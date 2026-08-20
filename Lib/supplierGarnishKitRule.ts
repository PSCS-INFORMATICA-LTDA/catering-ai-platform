/**
 * Packing operacional de guarnição ao fornecedor — configurável por empresa
 * via commercial_rules.rule_key = supplier_garnish_kit_packing.
 *
 * Sem regra ativa (ou enabled:false), a empresa NÃO herda o modelo CDL.
 */

export const SUPPLIER_GARNISH_KIT_RULE_KEY = 'supplier_garnish_kit_packing'

export type GarnishKitItemKey =
  | 'arroz_branco_grande'
  | 'feijao_tropeiro_grande'
  | 'maionese_grande'
  | 'vinagrete'
  | 'arroz_branco_pequeno'
  | 'feijao_tropeiro_pequeno'
  | 'maionese_pequena'

export type GarnishKitItemLabels = {
  labelPt: string
  labelEn: string
  labelEs: string
}

/** Config JSON armazenada em commercial_rules.rule_value.value (type=json). */
export type SupplierGarnishKitConfig = {
  enabled: boolean
  /** Cascata ET: se totalPeople > threshold → kits (ordem do maior para o menor). */
  large_kit_gt: Array<[number, number]>
  small_kit: {
    /** ET < 30 */
    lt30: number
    /** 51 ≤ ET ≤ 69 */
    from51_to69: number
  }
  /** Cascata adultos: adults < threshold → UN */
  vinagrete_adults_lt: Array<[number, number]>
  /** Cascata adultos: adults > threshold → UN */
  vinagrete_adults_gt: Array<[number, number]>
  /** Adults < 30 → UN de arroz pequeno (HI) */
  arroz_pequeno_adults_lt30: number
  /** UN por quantidade de kit grande (chave "1" | "2") */
  large_units: Partial<
    Record<
      'arroz_branco_grande' | 'feijao_tropeiro_grande' | 'maionese_grande',
      Record<string, number>
    >
  >
  /** UN por quantidade de kit pequeno */
  small_units: Partial<
    Record<'feijao_tropeiro_pequeno' | 'maionese_pequena', Record<string, number>>
  >
  labels?: Partial<Record<GarnishKitItemKey, GarnishKitItemLabels>>
}

export type GarnishKitItem = {
  key: GarnishKitItemKey
  units: number
} & GarnishKitItemLabels

export type GarnishKitResult = {
  largeKits: number
  smallKits: number
  items: GarnishKitItem[]
}

const DEFAULT_LABELS: Record<GarnishKitItemKey, GarnishKitItemLabels> = {
  arroz_branco_grande: {
    labelPt: 'Arroz branco grande',
    labelEn: 'Large white rice',
    labelEs: 'Arroz blanco grande',
  },
  feijao_tropeiro_grande: {
    labelPt: 'Feijão tropeiro grande',
    labelEn: 'Large tropeiro beans',
    labelEs: 'Frijoles tropeiro grandes',
  },
  maionese_grande: {
    labelPt: 'Maionese grande',
    labelEn: 'Large potato salad',
    labelEs: 'Mayonesa grande',
  },
  vinagrete: {
    labelPt: 'Vinagrete',
    labelEn: 'Vinaigrette',
    labelEs: 'Vinagreta',
  },
  arroz_branco_pequeno: {
    labelPt: 'Arroz branco pequeno',
    labelEn: 'Small white rice',
    labelEs: 'Arroz blanco pequeño',
  },
  feijao_tropeiro_pequeno: {
    labelPt: 'Feijão tropeiro pequeno',
    labelEn: 'Small tropeiro beans',
    labelEs: 'Frijoles tropeiro pequeños',
  },
  maionese_pequena: {
    labelPt: 'Maionese pequena',
    labelEn: 'Small potato salad',
    labelEs: 'Mayonesa pequeña',
  },
}

/** Preset CDL (QuoteCDL HC–HK) — só deve existir na commercial_rules da CDL. */
export const CDL_SUPPLIER_GARNISH_KIT_CONFIG: SupplierGarnishKitConfig = {
  enabled: true,
  large_kit_gt: [
    [69, 2],
    [29, 1],
  ],
  small_kit: {
    lt30: 1,
    from51_to69: 1,
  },
  vinagrete_adults_lt: [
    [30, 2],
    [51, 4],
  ],
  vinagrete_adults_gt: [
    [69, 8],
    [50, 6],
  ],
  arroz_pequeno_adults_lt30: 2,
  large_units: {
    arroz_branco_grande: { '1': 2, '2': 3 },
    feijao_tropeiro_grande: { '1': 1, '2': 2 },
    maionese_grande: { '1': 1, '2': 2 },
  },
  small_units: {
    feijao_tropeiro_pequeno: { '1': 1 },
    maionese_pequena: { '1': 1 },
  },
}

export function serializeSupplierGarnishKitConfig(
  config: SupplierGarnishKitConfig,
): string {
  return JSON.stringify(config)
}

function isPairArray(value: unknown): value is Array<[number, number]> {
  if (!Array.isArray(value)) return false
  return value.every(
    (row) =>
      Array.isArray(row) &&
      row.length >= 2 &&
      Number.isFinite(Number(row[0])) &&
      Number.isFinite(Number(row[1])),
  )
}

/** Parseia rule_value.value (string JSON ou objeto). Retorna null se inválido. */
export function parseSupplierGarnishKitConfig(
  raw: unknown,
): SupplierGarnishKitConfig | null {
  let data: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      data = JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  if (obj.enabled === false) {
    return { ...CDL_SUPPLIER_GARNISH_KIT_CONFIG, enabled: false }
  }

  const largeGt = isPairArray(obj.large_kit_gt)
    ? obj.large_kit_gt.map(([a, b]) => [Number(a), Number(b)] as [number, number])
    : CDL_SUPPLIER_GARNISH_KIT_CONFIG.large_kit_gt

  const smallRaw = (obj.small_kit ?? {}) as Record<string, unknown>
  const small_kit = {
    lt30: Number(smallRaw.lt30 ?? CDL_SUPPLIER_GARNISH_KIT_CONFIG.small_kit.lt30),
    from51_to69: Number(
      smallRaw.from51_to69 ?? CDL_SUPPLIER_GARNISH_KIT_CONFIG.small_kit.from51_to69,
    ),
  }

  const vinLt = isPairArray(obj.vinagrete_adults_lt)
    ? obj.vinagrete_adults_lt.map(
        ([a, b]) => [Number(a), Number(b)] as [number, number],
      )
    : CDL_SUPPLIER_GARNISH_KIT_CONFIG.vinagrete_adults_lt
  const vinGt = isPairArray(obj.vinagrete_adults_gt)
    ? obj.vinagrete_adults_gt.map(
        ([a, b]) => [Number(a), Number(b)] as [number, number],
      )
    : CDL_SUPPLIER_GARNISH_KIT_CONFIG.vinagrete_adults_gt

  return {
    enabled: obj.enabled !== false,
    large_kit_gt: largeGt,
    small_kit,
    vinagrete_adults_lt: vinLt,
    vinagrete_adults_gt: vinGt,
    arroz_pequeno_adults_lt30: Number(
      obj.arroz_pequeno_adults_lt30 ??
        CDL_SUPPLIER_GARNISH_KIT_CONFIG.arroz_pequeno_adults_lt30,
    ),
    large_units: (obj.large_units ??
      CDL_SUPPLIER_GARNISH_KIT_CONFIG.large_units) as SupplierGarnishKitConfig['large_units'],
    small_units: (obj.small_units ??
      CDL_SUPPLIER_GARNISH_KIT_CONFIG.small_units) as SupplierGarnishKitConfig['small_units'],
    labels: (obj.labels ?? undefined) as SupplierGarnishKitConfig['labels'],
  }
}

function toNonNegInt(value: number | null | undefined): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

function firstGtMatch(pairs: Array<[number, number]>, n: number): number {
  for (const [threshold, units] of pairs) {
    if (n > threshold) return units
  }
  return 0
}

function firstLtMatch(pairs: Array<[number, number]>, n: number): number {
  for (const [threshold, units] of pairs) {
    if (n < threshold) return units
  }
  return 0
}

function labelsFor(
  config: SupplierGarnishKitConfig,
  key: GarnishKitItemKey,
): GarnishKitItemLabels {
  return config.labels?.[key] ?? DEFAULT_LABELS[key]
}

function pushItem(
  config: SupplierGarnishKitConfig,
  items: GarnishKitItem[],
  key: GarnishKitItemKey,
  units: number,
) {
  if (units <= 0) return
  items.push({ key, units, ...labelsFor(config, key) })
}

export function computeGarnishKitsFromConfig(
  config: SupplierGarnishKitConfig | null | undefined,
  input: {
    hasGarnish: boolean
    totalPeople: number | null | undefined
    adultCount?: number | null | undefined
  },
): GarnishKitResult {
  const empty: GarnishKitResult = { largeKits: 0, smallKits: 0, items: [] }
  if (!config?.enabled || !input.hasGarnish) return empty

  const totalPeople = toNonNegInt(input.totalPeople)
  const adultCount = toNonNegInt(
    input.adultCount != null && Number(input.adultCount) > 0
      ? input.adultCount
      : input.totalPeople,
  )
  if (totalPeople <= 0) return empty

  const largeKits = firstGtMatch(config.large_kit_gt, totalPeople)
  let smallKits = 0
  if (totalPeople < 30) smallKits = Number(config.small_kit.lt30) || 0
  else if (totalPeople >= 51 && totalPeople <= 69) {
    smallKits = Number(config.small_kit.from51_to69) || 0
  }

  const items: GarnishKitItem[] = []
  const largeKey = String(largeKits)
  const smallKey = String(smallKits)

  pushItem(
    config,
    items,
    'arroz_branco_grande',
    Number(config.large_units.arroz_branco_grande?.[largeKey] ?? 0),
  )
  pushItem(
    config,
    items,
    'feijao_tropeiro_grande',
    Number(config.large_units.feijao_tropeiro_grande?.[largeKey] ?? 0),
  )
  pushItem(
    config,
    items,
    'maionese_grande',
    Number(config.large_units.maionese_grande?.[largeKey] ?? 0),
  )

  const vinFromLt = firstLtMatch(config.vinagrete_adults_lt, adultCount)
  const vinagrete =
    vinFromLt > 0
      ? vinFromLt
      : firstGtMatch(config.vinagrete_adults_gt, adultCount)
  pushItem(config, items, 'vinagrete', vinagrete)

  pushItem(
    config,
    items,
    'arroz_branco_pequeno',
    adultCount < 30 ? Number(config.arroz_pequeno_adults_lt30) || 0 : 0,
  )
  pushItem(
    config,
    items,
    'feijao_tropeiro_pequeno',
    Number(config.small_units.feijao_tropeiro_pequeno?.[smallKey] ?? 0),
  )
  pushItem(
    config,
    items,
    'maionese_pequena',
    Number(config.small_units.maionese_pequena?.[smallKey] ?? 0),
  )

  return { largeKits, smallKits, items }
}

export function labelForGarnishKitItem(
  item: GarnishKitItem,
  language: string | null | undefined,
): string {
  const lang = (language ?? 'pt').slice(0, 2).toLowerCase()
  if (lang === 'en') return item.labelEn
  if (lang === 'es') return item.labelEs
  return item.labelPt
}

export function toSupplierGarnishCdlKitsInput(
  result: GarnishKitResult,
  language: string | null | undefined,
): {
  largeKits: number
  smallKits: number
  items: Array<{ label: string; units: number }>
} {
  return {
    largeKits: result.largeKits,
    smallKits: result.smallKits,
    items: result.items.map((item) => ({
      label: labelForGarnishKitItem(item, language),
      units: item.units,
    })),
  }
}

export function isKitCoveredSideLabel(label: string): boolean {
  return /arroz|feij[aã]o|tropeiro|maionese|mayonnaise|vinagrete|vinagreta/i.test(
    label.trim(),
  )
}

/** rule_value pronto para insert em commercial_rules. */
export function buildSupplierGarnishKitRuleValue(
  config: SupplierGarnishKitConfig = CDL_SUPPLIER_GARNISH_KIT_CONFIG,
) {
  return {
    value: serializeSupplierGarnishKitConfig(config),
    type: 'json',
    label_pt: 'Packing guarnição fornecedor (kits HC–HK)',
  }
}
