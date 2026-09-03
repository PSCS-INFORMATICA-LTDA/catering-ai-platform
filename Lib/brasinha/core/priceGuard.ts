function walkAmounts(value: unknown, into: number[]) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    into.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) walkAmounts(item, into)
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (
        /percent|percentage|ratio/i.test(key) &&
        typeof item === 'number' &&
        item === 25
      ) {
        continue
      }
      walkAmounts(item, into)
    }
  }
}

export function collectCanonicalAmounts(payloads: unknown[]): number[] {
  const amounts: number[] = []
  for (const payload of payloads) walkAmounts(payload, amounts)
  return amounts
}

const MONEY =
  /(?:US\$|R\$|\$)\s*(\d+(?:[.,]\d+)?)|\b(\d+)[.,](\d{2})\b/gi

export function extractMentionedMoney(text: string): number[] {
  const found: number[] = []
  for (const match of text.matchAll(MONEY)) {
    const raw = match[1] ?? `${match[2]}.${match[3]}`
    const normalized = raw.replace(',', '.')
    const value = Number(normalized)
    if (Number.isFinite(value)) found.push(value)
  }
  return found
}

export function replyInventedPrice(
  text: string,
  allowedAmounts: number[],
): boolean {
  const mentioned = extractMentionedMoney(text)
  if (!mentioned.length) return false
  if (!allowedAmounts.length) return true
  return mentioned.some(
    (value) => !allowedAmounts.some((allowed) => Math.abs(allowed - value) < 0.02),
  )
}
