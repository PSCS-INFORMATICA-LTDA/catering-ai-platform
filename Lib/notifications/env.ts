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

export function whatsAppTemplateName() {
  return process.env.WHATSAPP_TEMPLATE_NEW_QUOTE?.trim() || 'new_quote_internal'
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

export function quoteDeepLinkUrl(quoteId: string) {
  return `${notificationAppOrigin()}${quoteDeepLinkPath(quoteId)}`
}
