import {
  buildPaymentWhatsAppHref,
  paymentSharePhoneDigits,
} from './paymentShareMessage.ts'

/**
 * iOS / browser limitations (document for QA):
 *
 * - `https://wa.me/{digits}` is a Universal Link claimed by WhatsApp Messenger.
 *   When Messenger and WhatsApp Business are both installed, iOS typically
 *   opens Messenger. The browser cannot choose Business via wa.me.
 * - There is no web API to query which WhatsApp app is installed.
 * - The only Business-first path is the `whatsapp-business://send` scheme
 *   (Android may also honor `intent://` + package `com.whatsapp.w4b`).
 * - If Business is missing, the custom scheme fails. We then fall back to the
 *   canonical `wa.me` href so the operator is never stranded.
 * - Desktop keeps the existing WhatsApp Web / wa.me path.
 *
 * Message text always comes from `buildPaymentShareMessage`. Phone digits
 * always come from `paymentSharePhoneDigits`. This module does not rebuild
 * either contract.
 */

export const WHATSAPP_BUSINESS_FALLBACK_MS = 1400

export type PaymentWhatsAppOpenMode = 'business' | 'web' | 'invalid-phone'

export type PaymentWhatsAppOpenPlan = {
  ok: boolean
  mode: PaymentWhatsAppOpenMode
  phoneDigits: string | null
  businessHref: string | null
  androidIntentHref: string | null
  fallbackHref: string | null
}

export type PaymentWhatsAppOpenDeps = {
  isMobile: boolean
  isAndroid?: boolean
  assign: (href: string) => void
  openBlank: (href: string) => boolean
  scheduleFallback: (fn: () => void, ms: number) => void
  pageStillVisible: () => boolean
}

export function isLikelyMobileWhatsAppHost(
  userAgent: string | null | undefined = typeof navigator === 'undefined'
    ? ''
    : navigator.userAgent,
): boolean {
  return /Android|iPhone|iPad|iPod/i.test(String(userAgent || ''))
}

export function isLikelyAndroidWhatsAppHost(
  userAgent: string | null | undefined = typeof navigator === 'undefined'
    ? ''
    : navigator.userAgent,
): boolean {
  return /Android/i.test(String(userAgent || ''))
}

export function buildPaymentWhatsAppBusinessHref(
  phone: string | null | undefined,
  text: string,
): string | null {
  const digits = paymentSharePhoneDigits(phone)
  if (!digits) return null
  const message = String(text || '')
  return message
    ? `whatsapp-business://send?phone=${digits}&text=${encodeURIComponent(message)}`
    : `whatsapp-business://send?phone=${digits}`
}

export function buildPaymentWhatsAppBusinessAndroidIntent(
  phone: string | null | undefined,
  text: string,
): string | null {
  const digits = paymentSharePhoneDigits(phone)
  const fallback = buildPaymentWhatsAppHref(phone, text)
  if (!digits || !fallback) return null
  const message = String(text || '')
  const textPart = message ? `&text=${encodeURIComponent(message)}` : ''
  return `intent://send?phone=${digits}${textPart}#Intent;scheme=whatsapp-business;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(fallback)};end`
}

export function resolvePaymentWhatsAppOpenPlan(input: {
  phone: string | null | undefined
  text: string
  isMobile?: boolean
  isAndroid?: boolean
}): PaymentWhatsAppOpenPlan {
  const phoneDigits = paymentSharePhoneDigits(input.phone)
  const fallbackHref = buildPaymentWhatsAppHref(input.phone, input.text)
  if (!phoneDigits || !fallbackHref) {
    return {
      ok: false,
      mode: 'invalid-phone',
      phoneDigits: null,
      businessHref: null,
      androidIntentHref: null,
      fallbackHref: null,
    }
  }

  if (!input.isMobile) {
    return {
      ok: true,
      mode: 'web',
      phoneDigits,
      businessHref: null,
      androidIntentHref: null,
      fallbackHref,
    }
  }

  return {
    ok: true,
    mode: 'business',
    phoneDigits,
    businessHref: buildPaymentWhatsAppBusinessHref(input.phone, input.text),
    androidIntentHref: input.isAndroid
      ? buildPaymentWhatsAppBusinessAndroidIntent(input.phone, input.text)
      : null,
    fallbackHref,
  }
}

function defaultOpenDeps(): PaymentWhatsAppOpenDeps {
  return {
    isMobile: isLikelyMobileWhatsAppHost(),
    isAndroid: isLikelyAndroidWhatsAppHost(),
    assign: (href) => {
      window.location.assign(href)
    },
    openBlank: (href) => {
      const opened = window.open(href, '_blank', 'noopener,noreferrer')
      return Boolean(opened)
    },
    scheduleFallback: (fn, ms) => {
      window.setTimeout(fn, ms)
    },
    pageStillVisible: () => {
      if (typeof document === 'undefined') return true
      return document.visibilityState === 'visible'
    },
  }
}

function openFallbackHref(
  href: string,
  deps: PaymentWhatsAppOpenDeps,
) {
  if (!deps.openBlank(href)) deps.assign(href)
}

/**
 * Progressive enhancement: Business scheme on mobile, then canonical wa.me.
 * Never auto-sends. Never leaves the operator without an exit when a phone exists.
 */
export function openPaymentWhatsAppShare(
  input: {
    phone: string | null | undefined
    text: string
  },
  deps: PaymentWhatsAppOpenDeps = defaultOpenDeps(),
): PaymentWhatsAppOpenPlan {
  const plan = resolvePaymentWhatsAppOpenPlan({
    phone: input.phone,
    text: input.text,
    isMobile: deps.isMobile,
    isAndroid: deps.isAndroid,
  })
  if (!plan.ok || !plan.fallbackHref) return plan

  if (plan.mode === 'web' || !plan.businessHref) {
    openFallbackHref(plan.fallbackHref, deps)
    return plan
  }

  let leftPage = false
  const primaryHref = plan.androidIntentHref || plan.businessHref
  deps.assign(primaryHref)
  deps.scheduleFallback(() => {
    if (leftPage || !deps.pageStillVisible()) return
    leftPage = true
    openFallbackHref(plan.fallbackHref as string, deps)
  }, WHATSAPP_BUSINESS_FALLBACK_MS)

  return plan
}
