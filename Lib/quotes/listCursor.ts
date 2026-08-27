export type QuoteListCursor = {
  created_at: string
  id: string
}

export function encodeQuoteListCursor(cursor: QuoteListCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeQuoteListCursor(
  raw: string | null | undefined,
): QuoteListCursor | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as Partial<QuoteListCursor>
    if (
      typeof parsed.created_at === 'string' &&
      parsed.created_at &&
      typeof parsed.id === 'string' &&
      parsed.id
    ) {
      return { created_at: parsed.created_at, id: parsed.id }
    }
  } catch {
    /* ignore malformed cursor */
  }
  return null
}

export function quoteListCursorOrFilter(cursor: QuoteListCursor): string {
  const createdAt = cursor.created_at.replace(/"/g, '')
  const id = cursor.id.replace(/[^a-zA-Z0-9-]/g, '')
  return `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt.${id})`
}
