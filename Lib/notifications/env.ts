export function isWhatsAppNotificationsEnabled() {
  const flag = String(process.env.WHATSAPP_NOTIFICATIONS_ENABLED || '').trim().toLowerCase()
  if (flag === 'false' || flag === '0' || flag === 'off') return false
  if (flag === 'true' || flag === '1' || flag === 'on') {
    return Boolean(whatsAppAccessToken() && whatsAppPhoneNumberId())
  }
  return Boolean(whatsAppAccessToken() && whatsAppPhoneNumberId())
}

export function whatsAppAccessToken() {
  return (
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() ||
    process.env.META_WHATSAPP_ACCESS_TOKEN?.trim() ||
    ''
  )
}

export function whatsAppPhoneNumberId() {
  return (
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    ''
  )
}

export function notificationAppOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_ORIGIN?.trim().replace(/\/$/, '') ||
    'https://catering-ai-agenda-dev.vercel.app'
  )
}

export function quoteDeepLinkPath(quoteId: string) {
  return `/quotes/${quoteId}`
}

export function invoiceDeepLinkPath(invoiceId: string) {
  return `/invoices/${invoiceId}`
}

export function quoteDeepLinkUrl(quoteId: string) {
  return `${notificationAppOrigin()}${quoteDeepLinkPath(quoteId)}`
}

export function invoiceDeepLinkUrl(invoiceId: string) {
  return `${notificationAppOrigin()}${invoiceDeepLinkPath(invoiceId)}`
}

export function notificationDeepLinkUrl(path: string) {
  return `${notificationAppOrigin()}${path.startsWith('/') ? path : `/${path}`}`
}

export function whatsAppTemplateName(eventKey?: string) {
  if (eventKey === 'payment.deposit_received') {
    return process.env.WHATSAPP_TEMPLATE_DEPOSIT?.trim() || 'payment_deposit_received_internal'
  }
  if (eventKey === 'payment.full_received') {
    return process.env.WHATSAPP_TEMPLATE_FULL?.trim() || 'payment_full_received_internal'
  }
  return process.env.WHATSAPP_TEMPLATE_NEW_QUOTE?.trim() || 'new_quote_internal'
}
