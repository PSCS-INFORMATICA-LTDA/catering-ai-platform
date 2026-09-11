/** Preserve server-owned metadata and optional fields when older clients save. */
const MAX_FIELD = 200
const MAX_INSTRUCTIONS = 1200
export function cleanOfflineField(value: unknown, max = MAX_FIELD): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
export function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) } : {}
}
export function buildOfflineMetadata(
  zelle: Record<string, unknown>, bank: Record<string, unknown>,
  existingZelle: unknown, existingBank: unknown,
) {
  const bankMetadata = {
    ...metadataRecord(existingBank),
    bank_name: cleanOfflineField(bank.bankName),
    account_holder: cleanOfflineField(bank.accountHolder),
    routing_number: cleanOfflineField(bank.routingNumber),
    account_number: cleanOfflineField(bank.accountNumber),
    instructions: cleanOfflineField(bank.instructions, MAX_INSTRUCTIONS),
  }
  const optional: Record<string, unknown> = {}
  for (const [field, key] of [
    ['wireRoutingNumber', 'wire_routing_number'],
    ['paymentAddress', 'payment_address'],
    ['checkPayableTo', 'check_payable_to'],
  ] as const) {
    if (typeof bank[field] === 'string') optional[key] = cleanOfflineField(bank[field])
  }
  return {
    zelle: {
      ...metadataRecord(existingZelle),
      recipient_name: cleanOfflineField(zelle.recipientName),
      recipient_contact: cleanOfflineField(zelle.recipientContact),
      instructions: cleanOfflineField(zelle.instructions, MAX_INSTRUCTIONS),
    },
    bankTransfer: { ...bankMetadata, ...optional },
  }
}
