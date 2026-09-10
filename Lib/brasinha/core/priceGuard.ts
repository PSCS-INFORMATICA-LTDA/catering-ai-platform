function walkAmounts(value: unknown, into: number[]) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    into.push(value)
    return
  }
  if (typeof value === 'string') {
    const parsed = parseMoneyAmount(value)
    if (parsed != null) into.push(parsed)
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

/** Parse a money token. Supports 1.000 / 1,000 / 65,00 / 65.00. Never treat dates as money. */
export function parseMoneyAmount(raw: string): number | null {
  const token = raw.trim()
  if (!token || !/^\d+(?:[.,]\d+)*$/.test(token)) return null

  const lastComma = token.lastIndexOf(',')
  const lastDot = token.lastIndexOf('.')
  let normalized = token

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = token.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = token.replace(/,/g, '')
    }
  } else if (lastComma >= 0) {
    const fraction = token.slice(lastComma + 1)
    normalized = fraction.length === 3 ? token.replace(/,/g, '') : token.replace(',', '.')
  } else if (lastDot >= 0) {
    const fraction = token.slice(lastDot + 1)
    if (fraction.length === 3) normalized = token.replace(/\./g, '')
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

const CURRENCY_MONEY =
  /(?:US\$|R\$|\$)\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi
const UNIT_MONEY =
  /\b(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:por pessoa|\/\s*pessoa|d[oó]lares?|dollars?|reais)\b/gi

export function extractMentionedMoney(text: string): number[] {
  const found: number[] = []
  for (const pattern of [CURRENCY_MONEY, UNIT_MONEY]) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      const value = parseMoneyAmount(match[1] ?? '')
      if (value != null && !found.some((existing) => Math.abs(existing - value) < 0.02)) {
        found.push(value)
      }
    }
  }
  return found
}

export function unapprovedMentionedAmounts(
  text: string,
  allowedAmounts: number[],
): number[] {
  return extractMentionedMoney(text).filter(
    (value) => !allowedAmounts.some((allowed) => Math.abs(allowed - value) < 0.02),
  )
}

export function replyInventedPrice(
  text: string,
  allowedAmounts: number[],
): boolean {
  const mentioned = extractMentionedMoney(text)
  if (!mentioned.length) return false
  if (!allowedAmounts.length) return true
  return unapprovedMentionedAmounts(text, allowedAmounts).length > 0
}
