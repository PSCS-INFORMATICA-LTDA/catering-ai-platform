/**
 * Colunas reais de `public.events` permitidas em insert/update.
 *
 * `company_id` é obrigatório no INSERT: a policy `events_insert_member`
 * usa `private.is_company_member(company_id)` e recusa NULL (SQLSTATE 42501).
 * O valor deve vir do tenant resolver — nunca de company_id enviado pelo cliente.
 */
export const EVENTS_INSERT_COLUMNS = [
  'company_id',
  'customer_id',
  'event_name',
  'event_date',
  'start_time',
  'end_time',
  'address_line',
  'city',
  'state',
  'postal_code',
  'country',
  'adults_count',
  'children_count',
  'billable_guests',
  'total_guests',
  'has_grill',
  'grill_photo_required',
  'grill_rental_required',
  'grill_rental_qty',
  'grill_notes',
  'grill_masters_qty',
  'assistants_qty',
  'distance_from_base',
  'mileage_notes',
  'active',
] as const

export type EventsInsertColumn = (typeof EVENTS_INSERT_COLUMNS)[number]

export type EventsInsertValue = string | number | boolean | null

export type EventsInsertPayload = Partial<
  Record<EventsInsertColumn, EventsInsertValue>
>

const FORBIDDEN_EVENT_COLUMNS = new Set(['zip_code', 'zipCode'])

/** Remove chaves inexistentes/forbidden antes do insert/update em `events`. */
export function pickEventsInsertPayload(
  row: EventsInsertPayload,
): Record<string, EventsInsertValue> {
  const payload: Record<string, EventsInsertValue> = {}

  for (const key of EVENTS_INSERT_COLUMNS) {
    if (!(key in row)) continue
    const value = row[key]
    if (value === undefined) continue
    if (typeof value === 'string' && value.trim() === '') {
      payload[key] = null
      continue
    }
    payload[key] = value
  }

  return payload
}

/** Garante que zip_code nunca vá para Supabase (usa postal_code). */
export function assertNoForbiddenEventColumns(
  payload: Record<string, unknown>,
) {
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_EVENT_COLUMNS.has(key)) {
      throw new Error(
        `Coluna proibida em events: ${key}. Use postal_code em vez de zip_code.`,
      )
    }
    if (!EVENTS_INSERT_COLUMNS.includes(key as EventsInsertColumn)) {
      throw new Error(`Coluna inexistente em events: ${key}`)
    }
  }
}
