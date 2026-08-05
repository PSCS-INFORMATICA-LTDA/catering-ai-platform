/**
 * Colunas reais de `public.customers` (schema de produção / Address Book).
 * Não inclui `customer_name`, `first_name` ou `last_name`.
 * Para exibição use `vw_customer_display.customer_display_name` ou getCustomerDisplayName().
 * @see scripts/sql/vw-customer-display.sql
 */
export const CUSTOMERS_TABLE_COLUMNS = [
  'company_id',
  'ab_name',
  'phone',
  'phone_normalized',
  'email',
  'address',
  'city',
  'state',
  'customer_type',
  'full_name',
  'company_name',
  'address_line',
  'postal_code',
  'country',
  'preferred_language',
  'notes',
  'active',
  'ab_number',
  'ab_type',
  'legacy_id',
  'address_book_role',
  'is_customer',
  'is_supplier',
  'is_team',
  'contact_name',
  'tax_id',
  'website',
  'source',
  'tags',
  'created_at',
  'updated_at',
] as const

export type CustomersTableColumn = (typeof CUSTOMERS_TABLE_COLUMNS)[number]

/** Subconjunto seguro para insert/update em `customers`. */
export const CUSTOMERS_INSERT_COLUMNS = [
  'company_id',
  'ab_name',
  'phone',
  'phone_normalized',
  'email',
  'full_name',
  'contact_name',
  'company_name',
  'address_line',
  'city',
  'state',
  'postal_code',
  'preferred_language',
  'is_customer',
  'is_supplier',
  'is_team',
  'ab_number',
  'active',
] as const satisfies ReadonlyArray<CustomersTableColumn>

export const CUSTOMERS_UPDATE_COLUMNS = [
  'ab_name',
  'phone',
  'phone_normalized',
  'email',
  'full_name',
  'contact_name',
  'company_name',
  'address',
  'city',
  'state',
  'address_line',
  'postal_code',
  'country',
  'customer_type',
  'preferred_language',
  'is_customer',
  'is_supplier',
  'is_team',
  'notes',
  'source',
  'website',
  'tax_id',
  'active',
] as const satisfies ReadonlyArray<CustomersTableColumn>

export type CustomersInsertColumn = (typeof CUSTOMERS_INSERT_COLUMNS)[number]

export type CustomersInsertPayload = Partial<
  Record<CustomersInsertColumn, string | boolean | null>
>

/** Colunas usadas por `getCustomerDisplayName` em queries Supabase. */
export const CUSTOMERS_NAME_SOURCE_COLUMNS = [
  'ab_name',
  'full_name',
  'contact_name',
  'company_name',
  'email',
  'phone',
] as const satisfies ReadonlyArray<CustomersTableColumn>

export type CustomersNameSourceColumn =
  (typeof CUSTOMERS_NAME_SOURCE_COLUMNS)[number]

const CUSTOMERS_TABLE_COLUMN_SET = new Set<string>(CUSTOMERS_TABLE_COLUMNS)

export function isCustomersTableColumn(
  key: string,
): key is CustomersTableColumn {
  return CUSTOMERS_TABLE_COLUMN_SET.has(key)
}

type CustomersSelectColumn = 'id' | CustomersTableColumn

/** Monta cláusula `.select()` apenas com colunas reais de `customers`. */
export function buildCustomersSelect(
  include: ReadonlyArray<CustomersSelectColumn> = [
    'id',
    ...CUSTOMERS_NAME_SOURCE_COLUMNS,
  ],
): string {
  const columns = include.filter(
    (col) => col === 'id' || isCustomersTableColumn(col),
  )
  return [...new Set(columns)].join(', ')
}

/** Wizard, autocomplete e vínculo por telefone. */
export function buildCustomersListSelect(): string {
  return [
    buildCustomersSelect([
      'id',
      'phone',
      'phone_normalized',
      'ab_number',
      'address_line',
      'preferred_language',
      'is_customer',
      'is_supplier',
      'is_team',
      'address_book_role',
      'active',
      ...CUSTOMERS_NAME_SOURCE_COLUMNS,
    ]),
    'city',
    'state',
    'postal_code',
    'source',
    'updated_at',
    'created_at',
  ].join(', ')
}

export type CustomersUpdatePayload = Partial<
  Record<(typeof CUSTOMERS_UPDATE_COLUMNS)[number], string | boolean | null>
>

export function pickCustomersInsertPayload(
  row: CustomersInsertPayload,
): Record<string, string | boolean | null> {
  const payload: Record<string, string | boolean | null> = {}

  for (const key of CUSTOMERS_INSERT_COLUMNS) {
    if (!(key in row)) continue
    const value = row[key]
    if (value === undefined) continue
    if (typeof value === 'string' && value.trim() === '') continue
    payload[key] = value
  }

  return payload
}

export function pickCustomersUpdatePayload(
  row: CustomersUpdatePayload,
): Record<string, string | boolean | null> {
  const payload: Record<string, string | boolean | null> = {}

  for (const key of CUSTOMERS_UPDATE_COLUMNS) {
    if (!(key in row)) continue
    const value = row[key]
    if (value === undefined) continue
    payload[key] = value
  }

  return payload
}
