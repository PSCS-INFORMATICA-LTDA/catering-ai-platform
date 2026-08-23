import { getCustomerDisplayName } from './getCustomerDisplayName'
import { normalizePhone } from './normalizePhone'

export type CustomerSearchRecord = {
  id?: string
  ab_name?: string | null
  full_name?: string | null
  contact_name?: string | null
  company_name?: string | null
  email?: string | null
  phone?: string | null
  phone_normalized?: string | null
  ab_number?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  preferred_language?: string | null
  is_customer?: boolean | null
  is_supplier?: boolean | null
  is_team?: boolean | null
  address_book_role?: string | null
  active?: boolean | null
  source?: string | null
  updated_at?: string | null
  created_at?: string | null
}

export function personRoleLabels(person: CustomerSearchRecord): string[] {
  const labels: string[] = []
  if (person.is_customer) labels.push('Cliente')
  if (person.is_supplier) labels.push('Fornecedor')
  if (person.is_team) labels.push('Equipe')
  if (labels.length === 0) labels.push('Cliente')
  return labels
}

function resolvePhoneKey(customer: CustomerSearchRecord): string {
  const normalized =
    customer.phone_normalized?.trim() || normalizePhone(customer.phone)
  return normalized.length >= 10 ? normalized : ''
}

function fieldMatchesQuery(
  field: string | null | undefined,
  query: string,
  queryDigits: string,
) {
  const text = field == null ? '' : String(field).trim().toLowerCase()
  if (!text) return false
  if (text.includes(query)) return true

  if (queryDigits.length < 3) return false

  const fieldDigits = normalizePhone(text)
  if (!fieldDigits) return false
  if (fieldDigits.includes(queryDigits) || queryDigits.includes(fieldDigits)) {
    return true
  }

  if (queryDigits.length >= 10 && fieldDigits.length >= 10) {
    return queryDigits.slice(-10) === fieldDigits.slice(-10)
  }

  return false
}

export function customerMatchesSearch(
  customer: CustomerSearchRecord,
  rawQuery: string,
): boolean {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true

  const queryDigits = normalizePhone(query)
  const displayName = getCustomerDisplayName(customer, { emptyLabel: '' })
    .trim()
    .toLowerCase()

  if (displayName && displayName.includes(query)) return true

  const fields = [
    customer.ab_name,
    customer.full_name,
    customer.contact_name,
    customer.company_name,
    customer.email,
    customer.phone,
    customer.phone_normalized,
    customer.ab_number,
  ]

  return fields.some((field) => fieldMatchesQuery(field, query, queryDigits))
}

/** Remove duplicados visíveis (mesmo id ou mesmo phone_normalized). */
export function dedupeCustomersList<T extends CustomerSearchRecord & { id: string }>(
  customers: T[],
): T[] {
  const sorted = sortCustomersByRecency(customers)
  const seenIds = new Set<string>()
  const seenPhones = new Set<string>()
  const result: T[] = []

  for (const customer of sorted) {
    if (seenIds.has(customer.id)) continue

    const phoneKey = resolvePhoneKey(customer)
    if (phoneKey && seenPhones.has(phoneKey)) continue

    seenIds.add(customer.id)
    if (phoneKey) seenPhones.add(phoneKey)
    result.push(customer)
  }

  return result
}

export function filterCustomersBySearch<T extends CustomerSearchRecord>(
  customers: T[],
  rawQuery: string,
): T[] {
  const deduped = dedupeCustomersList(
    customers.filter((row): row is T & { id: string } => Boolean(row.id)),
  ) as T[]

  const query = rawQuery.trim()
  if (!query) return deduped
  return deduped.filter((customer) => customerMatchesSearch(customer, query))
}

export function sortCustomersByRecency<T extends CustomerSearchRecord>(
  customers: T[],
): T[] {
  return [...customers].sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime()
    const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime()
    return bTime - aTime
  })
}

export function mergeCustomerIntoList<
  T extends CustomerSearchRecord & { id: string },
>(current: T[], incoming: T): T[] {
  const without = current.filter((row) => row.id !== incoming.id)
  const phoneKey = resolvePhoneKey(incoming)
  const withoutPhoneDup = phoneKey
    ? without.filter((row) => resolvePhoneKey(row) !== phoneKey)
    : without
  return dedupeCustomersList(sortCustomersByRecency([incoming, ...withoutPhoneDup]))
}
