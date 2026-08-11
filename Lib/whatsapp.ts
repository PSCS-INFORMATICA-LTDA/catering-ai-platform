import { isUsablePhone, toE164Digits } from './normalizePhone'

/** Abertura de WhatsApp (padrão Logistics) — deep link no aparelho do operador. */

export type WhatsAppOpenResult = {
  ok: boolean
  mode: 'native' | 'web' | 'invalid-phone' | 'debounced'
  phoneDigits: string | null
  copied: boolean
  error?: string
}

let lastNativePhone = ''
let lastNativeLaunchAt = 0
const NATIVE_DEBOUNCE_MS = 2000

/** Somente dígitos com DDI já informado. Não prefixa 55/1 em número local. */
export function normalizeWhatsAppPhone(
  phone: string | null | undefined,
): string | null {
  if (!isUsablePhone(phone)) return null
  return toE164Digits(phone) || null
}

function isWindowsDesktop(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Windows/i.test(ua) && !/Android|iPhone|iPad|iPod/i.test(ua)
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
}

export function copyWhatsAppMessageSync(text: string): boolean {
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

export function buildWhatsAppNativeUrl(params: {
  phone: string
  message?: string
}): string | null {
  const phoneDigits = normalizeWhatsAppPhone(params.phone)
  if (!phoneDigits) return null
  if (isWindowsDesktop()) {
    return `whatsapp://send?phone=${phoneDigits}`
  }
  const message = (params.message ?? '').trim()
  if (!message) return `whatsapp://send?phone=${phoneDigits}`
  const max = 500
  const short =
    encodeURIComponent(message).length <= max
      ? message
      : `${message.slice(0, 180).trim()}…`
  return `whatsapp://send?phone=${phoneDigits}&text=${encodeURIComponent(short)}`
}

export function buildWhatsAppWebUrl(params: {
  phone: string
  message?: string
}): string | null {
  const phoneDigits = normalizeWhatsAppPhone(params.phone)
  if (!phoneDigits) return null
  const message = params.message ?? ''
  const text = encodeURIComponent(message)
  return text
    ? `https://wa.me/${phoneDigits}?text=${text}`
    : `https://wa.me/${phoneDigits}`
}

export function openWhatsApp(params: {
  phone: string
  message?: string
}): WhatsAppOpenResult {
  const phoneDigits = normalizeWhatsAppPhone(params.phone)
  if (!phoneDigits) {
    return {
      ok: false,
      mode: 'invalid-phone',
      phoneDigits: null,
      copied: false,
      error: 'Telefone incompleto.',
    }
  }

  const now = Date.now()
  if (
    phoneDigits === lastNativePhone &&
    now - lastNativeLaunchAt < NATIVE_DEBOUNCE_MS
  ) {
    return { ok: true, mode: 'debounced', phoneDigits, copied: false }
  }

  const message = params.message ?? ''
  const copied = message.trim() ? copyWhatsAppMessageSync(message) : false
  const nativeUrl = buildWhatsAppNativeUrl({
    phone: phoneDigits,
    message: isMobileDevice() ? message : undefined,
  })
  if (!nativeUrl) {
    return {
      ok: false,
      mode: 'invalid-phone',
      phoneDigits: null,
      copied,
      error: 'Não foi possível montar o link do WhatsApp.',
    }
  }

  lastNativePhone = phoneDigits
  lastNativeLaunchAt = now
  window.location.assign(nativeUrl)
  return { ok: true, mode: 'native', phoneDigits, copied }
}

export function openWhatsAppWeb(params: {
  phone: string
  message?: string
}): WhatsAppOpenResult {
  const phoneDigits = normalizeWhatsAppPhone(params.phone)
  if (!phoneDigits) {
    return {
      ok: false,
      mode: 'invalid-phone',
      phoneDigits: null,
      copied: false,
      error: 'Telefone incompleto.',
    }
  }
  const message = params.message ?? ''
  if (message.trim()) copyWhatsAppMessageSync(message)
  const webUrl = buildWhatsAppWebUrl({ phone: phoneDigits, message })
  if (!webUrl) {
    return {
      ok: false,
      mode: 'invalid-phone',
      phoneDigits: null,
      copied: false,
      error: 'Não foi possível montar o WhatsApp Web.',
    }
  }
  window.location.assign(webUrl)
  return { ok: true, mode: 'web', phoneDigits, copied: Boolean(message.trim()) }
}

export function formatWhatsAppPhoneDisplay(
  phone: string | null | undefined,
): string {
  const digits = normalizeWhatsAppPhone(phone)
  if (!digits) return ''
  if (digits.startsWith('1') && digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.startsWith('55') && digits.length >= 12) {
    const rest = digits.slice(2)
    return `+55 (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`
  }
  return `+${digits}`
}
