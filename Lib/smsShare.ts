/** SMS deep-link (padrão Logistics) — abre o app de SMS do operador. */

export function canUseDeviceSms(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
}

export function copyTextToClipboardSync(text: string): boolean {
  if (typeof document === 'undefined' || !text) return false
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export function phoneDigitsForSms(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 ? digits : null
}

export function plainTextForSms(text: string): string {
  return text.replace(/\*/g, '').trim()
}

export function buildSmsShareHref(
  phone: string | null | undefined,
  text: string,
): string | null {
  const digits = phoneDigitsForSms(phone)
  if (!digits) return null
  const body = encodeURIComponent(plainTextForSms(text))
  if (!body) return `sms:${digits}`
  return `sms:${digits}?&body=${body}`
}
