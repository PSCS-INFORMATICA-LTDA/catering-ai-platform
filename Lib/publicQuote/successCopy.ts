import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export const PUBLIC_SUCCESS_COPY = {
  pt: {
    kicker: 'SOLICITAÇÃO RECEBIDA',
    title: 'Sua solicitação foi confirmada.',
    titleMark: 'Agora é com a CDL.',
    body: 'Nossa equipe vai revisar os detalhes e entrar em contato.',
    quote: 'Solicitação',
    date: 'Data',
    name: 'Evento',
    total: 'Estimativa',
    zelle: 'Pagamento disponível via Zelle.',
    contacts: 'Fale com a equipe',
    phone: 'WhatsApp',
    instagram: 'Instagram',
    restart: 'Criar outra solicitação',
    talk: 'Falar com a equipe',
  },
  en: {
    kicker: 'REQUEST RECEIVED',
    title: 'Your request has been confirmed.',
    titleMark: 'Now it is with CDL.',
    body: 'Our team will review the details and get in touch.',
    quote: 'Request',
    date: 'Date',
    name: 'Event',
    total: 'Estimate',
    zelle: 'Payment available via Zelle.',
    contacts: 'Talk to the team',
    phone: 'WhatsApp',
    instagram: 'Instagram',
    restart: 'Create another request',
    talk: 'Talk to the team',
  },
  es: {
    kicker: 'SOLICITUD RECIBIDA',
    title: 'Su solicitud fue confirmada.',
    titleMark: 'Ahora es con CDL.',
    body: 'Nuestro equipo revisará los detalles y se pondrá en contacto.',
    quote: 'Solicitud',
    date: 'Fecha',
    name: 'Evento',
    total: 'Estimación',
    zelle: 'Pago disponible vía Zelle.',
    contacts: 'Hable con el equipo',
    phone: 'WhatsApp',
    instagram: 'Instagram',
    restart: 'Crear otra solicitud',
    talk: 'Hablar con el equipo',
  },
} as const

export function publicSuccessCopy(locale: QuoteLanguage) {
  return PUBLIC_SUCCESS_COPY[locale]
}
