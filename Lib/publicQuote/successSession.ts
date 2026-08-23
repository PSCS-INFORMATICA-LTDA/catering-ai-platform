export type PublicQuoteSuccessSnapshot = {
  quote: {
    id: string
    number?: string | null
    eventName: string
    eventDate: string
    total?: number | null
    currency?: string | null
  }
  alreadySubmitted?: boolean
}

export function publicQuoteSuccessStorageKey(companySlug: string) {
  return `public-quote-success:${companySlug}`
}

const SUCCESS_CHANGE_EVENT = 'public-quote-success-change'

export function notifyPublicQuoteSuccessChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SUCCESS_CHANGE_EVENT))
}

export function subscribePublicQuoteSuccess(
  companySlug: string,
  onChange: () => void,
) {
  const key = publicQuoteSuccessStorageKey(companySlug)
  const handler = (event: Event) => {
    if (event instanceof StorageEvent && event.key && event.key !== key) return
    onChange()
  }
  window.addEventListener('storage', handler)
  window.addEventListener(SUCCESS_CHANGE_EVENT, handler)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener(SUCCESS_CHANGE_EVENT, handler)
  }
}

export function getPublicQuoteSuccessSnapshot(companySlug: string) {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(publicQuoteSuccessStorageKey(companySlug))
  } catch {
    return null
  }
}

function isSuccessResult(value: unknown): value is PublicQuoteSuccessSnapshot {
  if (!value || typeof value !== 'object') return false
  const quote = (value as { quote?: unknown }).quote
  if (!quote || typeof quote !== 'object') return false
  const record = quote as Record<string, unknown>
  return typeof record.id === 'string' && record.id.length > 0
}

export function readPublicQuoteSuccess(
  companySlug: string,
): PublicQuoteSuccessSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(publicQuoteSuccessStorageKey(companySlug))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return isSuccessResult(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writePublicQuoteSuccess(
  companySlug: string,
  result: PublicQuoteSuccessSnapshot,
) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      publicQuoteSuccessStorageKey(companySlug),
      JSON.stringify(result),
    )
    notifyPublicQuoteSuccessChange()
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPublicQuoteSuccess(companySlug: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(publicQuoteSuccessStorageKey(companySlug))
    notifyPublicQuoteSuccessChange()
  } catch {
    /* ignore quota / private mode */
  }
}
