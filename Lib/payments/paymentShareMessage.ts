import { isUsablePhone, toE164Digits } from '../normalizePhone.ts'

export function paymentSharePhoneDigits(
  phone: string | null | undefined,
): string | null {
  if (!isUsablePhone(phone)) return null
  return toE164Digits(phone) || null
}

export type PaymentShareLocale = 'pt' | 'en' | 'es'
export type PaymentSharePurpose = 'deposit' | 'balance' | 'full'

export type PaymentShareMessageInput = {
  locale: string | null | undefined
  companyDisplayName: string
  customerFirstName?: string | null
  quoteNumber?: string | null
  invoiceNumber?: string | null
  purpose: PaymentSharePurpose
  amount: number
  currency: string
  paymentUrl: string
}

export type PaymentShareMessageResult = {
  text: string
}

export function resolvePaymentShareLocale(
  value: string | null | undefined,
): PaymentShareLocale {
  const normalized = String(value || 'pt').trim().toLowerCase()
  if (normalized === 'en' || normalized.startsWith('en')) return 'en'
  if (normalized === 'es' || normalized.startsWith('es') || normalized.startsWith('spa')) {
    return 'es'
  }
  return 'pt'
}

export function customerFirstNameFromDisplayName(
  fullName: string | null | undefined,
): string {
  const trimmed = String(fullName || '').trim()
  if (!trimmed) return ''
  if (trimmed.includes('@')) return ''
  if (/^\+?\d[\d\s().-]{7,}$/.test(trimmed)) return ''
  if (/^cliente sem nome$/i.test(trimmed)) return ''
  return trimmed.split(/\s+/)[0] || ''
}

export function formatPaymentShareAmount(
  amount: number,
  currency: string,
  locale: string | null | undefined,
): string {
  const code = (currency || 'USD').toUpperCase()
  const lang = resolvePaymentShareLocale(locale)
  const tag = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US'
  try {
    return new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: code,
    }).format(Number(amount) || 0)
  } catch {
    return `${code} ${(Number(amount) || 0).toFixed(2)}`
  }
}

function greeting(locale: PaymentShareLocale, firstName: string): string {
  if (locale === 'en') return firstName ? `Hi, ${firstName}!` : 'Hi!'
  if (locale === 'es') return firstName ? `¡Hola, ${firstName}!` : '¡Hola!'
  return firstName ? `Olá, ${firstName}!` : 'Olá!'
}

/**
 * Pure WhatsApp/SMS payment share copy.
 * Display-only: never used as the charged amount. /pay/[token] is server-owned.
 * Brasinha/conversation layer can call this later with the same contract.
 */
export function buildPaymentShareMessage(
  input: PaymentShareMessageInput,
): PaymentShareMessageResult {
  const locale = resolvePaymentShareLocale(input.locale)
  const firstName = customerFirstNameFromDisplayName(input.customerFirstName)
  const companyName = String(input.companyDisplayName || '').trim() || 'Catering AI'
  const quoteNumber = String(input.quoteNumber || input.invoiceNumber || '').trim()
  const paymentUrl = String(input.paymentUrl || '').trim()
  const formattedAmount = formatPaymentShareAmount(
    input.amount,
    input.currency,
    locale,
  )
  const hi = greeting(locale, firstName)

  if (locale === 'en') {
    if (input.purpose === 'deposit') {
      return {
        text: [
          hi,
          '',
          `Here is the secure link to pay the deposit for quote`,
          `${quoteNumber} with ${companyName}.`,
          '',
          `Deposit amount: ${formattedAmount}`,
          '',
          paymentUrl,
          '',
          'Please let us know if you need any help.',
        ].join('\n'),
      }
    }
    if (input.purpose === 'full') {
      return {
        text: [
          hi,
          '',
          `Here is the secure link to pay the full amount for quote`,
          `${quoteNumber} with ${companyName}.`,
          '',
          `Amount due: ${formattedAmount}`,
          '',
          paymentUrl,
          '',
          'Please let us know if you need any help.',
        ].join('\n'),
      }
    }
    return {
      text: [
        hi,
        '',
        `Here is the secure link to pay the remaining balance for quote`,
        `${quoteNumber} with ${companyName}.`,
        '',
        `Balance due: ${formattedAmount}`,
        '',
        paymentUrl,
        '',
        'Please let us know if you need any help.',
      ].join('\n'),
    }
  }

  if (locale === 'es') {
    if (input.purpose === 'deposit') {
      return {
        text: [
          hi,
          '',
          `Aquí tienes el enlace seguro para pagar el depósito de tu cotización`,
          `${quoteNumber} con ${companyName}.`,
          '',
          `Valor del depósito: ${formattedAmount}`,
          '',
          paymentUrl,
          '',
          'Estamos a tu disposición si necesitas ayuda.',
        ].join('\n'),
      }
    }
    if (input.purpose === 'full') {
      return {
        text: [
          hi,
          '',
          `Aquí tienes el enlace seguro para pagar el importe total de tu`,
          `cotización ${quoteNumber} con ${companyName}.`,
          '',
          `Importe a pagar: ${formattedAmount}`,
          '',
          paymentUrl,
          '',
          'Estamos a tu disposición si necesitas ayuda.',
        ].join('\n'),
      }
    }
    return {
      text: [
        hi,
        '',
        `Aquí tienes el enlace seguro para pagar el saldo pendiente de tu`,
        `cotización ${quoteNumber} con ${companyName}.`,
        '',
        `Saldo pendiente: ${formattedAmount}`,
        '',
        paymentUrl,
        '',
        'Estamos a tu disposición si necesitas ayuda.',
      ].join('\n'),
    }
  }

  if (input.purpose === 'deposit') {
    return {
      text: [
        hi,
        '',
        `Segue o link seguro para pagamento do sinal da sua cotação`,
        `${quoteNumber} com ${companyName}.`,
        '',
        `Valor do sinal: ${formattedAmount}`,
        '',
        paymentUrl,
        '',
        'Se precisar de ajuda, estamos à disposição.',
      ].join('\n'),
    }
  }

  if (input.purpose === 'full') {
    return {
      text: [
        hi,
        '',
        `Segue o link seguro para pagamento total da sua cotação`,
        `${quoteNumber} com ${companyName}.`,
        '',
        `Valor a pagar: ${formattedAmount}`,
        '',
        paymentUrl,
        '',
        'Se precisar de ajuda, estamos à disposição.',
      ].join('\n'),
    }
  }

  return {
    text: [
      hi,
      '',
      `Segue o link seguro para pagamento do saldo da sua cotação`,
      `${quoteNumber} com ${companyName}.`,
      '',
      `Valor do saldo: ${formattedAmount}`,
      '',
      paymentUrl,
      '',
      'Se precisar de ajuda, estamos à disposição.',
    ].join('\n'),
  }
}

export function buildPaymentWhatsAppHref(
  phone: string | null | undefined,
  text: string,
): string | null {
  const digits = paymentSharePhoneDigits(phone)
  if (!digits) return null
  const message = String(text || '')
  return message
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${digits}`
}
