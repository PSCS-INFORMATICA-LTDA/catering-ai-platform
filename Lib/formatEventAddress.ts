/** Presentation-only event address. Does not change stored quote fields. */

export type EventAddressParts = {
  line?: string | null
  number?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

function compact(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatEventAddressLines(parts: EventAddressParts): string[] {
  const street = [compact(parts.line), compact(parts.number)]
    .filter(Boolean)
    .join(' ')
  const cityState = [compact(parts.city), compact(parts.state)]
    .filter(Boolean)
    .join(', ')
  const locality = [cityState, compact(parts.zip)].filter(Boolean).join(' ')
  return [street, locality].filter(Boolean)
}

export function formatEventAddressBlock(parts: EventAddressParts): string {
  return formatEventAddressLines(parts).join('\n')
}

function normalizeAddressText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[·,.#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isSameEventDestination(
  destination: string | null | undefined,
  eventAddress: string | null | undefined,
): boolean {
  const left = normalizeAddressText(destination ?? '')
  const right = normalizeAddressText(eventAddress ?? '')
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}
