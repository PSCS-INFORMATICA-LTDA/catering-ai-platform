const EXACT_PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/customer-quote',
  '/quote-request',
])

const SEGMENT_PUBLIC_PREFIXES = [
  '/auth',
  '/quote',
  '/proposta',
  '/designacao-equipe',
  '/confirmacao-equipe',
  '/confirmacao-guarnicao',
  '/conferencia-saida',
  '/api/public',
] as const

function isPathSegmentMatch(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isBackofficeQuotesPathname(pathname: string): boolean {
  return isPathSegmentMatch(pathname, '/quotes')
}

/** Single source of truth for routes that must never require an app session. */
export function isPublicRoutePathname(pathname: string): boolean {
  if (isBackofficeQuotesPathname(pathname)) return false
  if (EXACT_PUBLIC_PATHS.has(pathname)) return true
  return SEGMENT_PUBLIC_PREFIXES.some((prefix) =>
    isPathSegmentMatch(pathname, prefix),
  )
}

export function isPublicQuotePathname(pathname: string): boolean {
  return (
    isPathSegmentMatch(pathname, '/quote') &&
    !isBackofficeQuotesPathname(pathname)
  )
}
