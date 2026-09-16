import {
  buildPaymentWhatsAppHref,
  paymentSharePhoneDigits,
} from './paymentShareMessage.ts'

/**
 * Canonical human-assisted payment share opener.
 *
 * Physical iOS evidence (PR #50): custom WhatsApp schemes are rejected by
 * Safari as an invalid address. The only web/mobile action is
 * `https://wa.me/<E164>?text=...` from `buildPaymentWhatsAppHref`.
 *
 * iOS opens whichever WhatsApp the Universal Link is associated with.
 * The browser cannot choose Business vs Messenger and must not try:
 * no custom schemes, no Android intent URLs, no timers, no iframes,
 * no installed-app detection.
 *
 * Message text always comes from `buildPaymentShareMessage`. Phone digits
 * always come from `paymentSharePhoneDigits`. Zero auto-send: the operator
 * confirms send in WhatsApp.
 *
 * Future Brasinha automatic conversation must use the official WhatsApp
 * Business Platform / API and reuse `buildPaymentShareMessage`. Not in this PR.
 */

export type PaymentWhatsAppOpenMode = 'wa.me' | 'invalid-phone'

export type PaymentWhatsAppOpenPlan = {
  ok: boolean
  mode: PaymentWhatsAppOpenMode
  phoneDigits: string | null
  href: string | null
}

export type PaymentWhatsAppOpenDeps = {
  assign: (href: string) => void
  openBlank: (href: string) => boolean
}

export function resolvePaymentWhatsAppOpenPlan(input: {
  phone: string | null | undefined
  text: string
}): PaymentWhatsAppOpenPlan {
  const phoneDigits = paymentSharePhoneDigits(input.phone)
  const href = buildPaymentWhatsAppHref(input.phone, input.text)
  if (!phoneDigits || !href) {
    return {
      ok: false,
      mode: 'invalid-phone',
      phoneDigits: null,
      href: null,
    }
  }

  return {
    ok: true,
    mode: 'wa.me',
    phoneDigits,
    href,
  }
}

function defaultOpenDeps(): PaymentWhatsAppOpenDeps {
  return {
    assign: (href) => {
      window.location.assign(href)
    },
    openBlank: (href) => {
      const opened = window.open(href, '_blank', 'noopener,noreferrer')
      return Boolean(opened)
    },
  }
}

/**
 * Opens the canonical wa.me href. Same action on mobile and desktop.
 * Never auto-sends. Never leaves the operator without an exit when a phone exists.
 */
export function openPaymentWhatsAppShare(
  input: {
    phone: string | null | undefined
    text: string
  },
  deps: PaymentWhatsAppOpenDeps = defaultOpenDeps(),
): PaymentWhatsAppOpenPlan {
  const plan = resolvePaymentWhatsAppOpenPlan(input)
  if (!plan.ok || !plan.href) return plan
  if (!deps.openBlank(plan.href)) deps.assign(plan.href)
  return plan
}
