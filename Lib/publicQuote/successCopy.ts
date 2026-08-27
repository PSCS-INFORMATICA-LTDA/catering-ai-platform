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
    contactTeam: 'Contate o nosso time',
    phone: 'WhatsApp',
    instagram: 'Instagram',
    restart: 'Criar outra solicitação',
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
    contactTeam: 'Contact our team',
    phone: 'WhatsApp',
    instagram: 'Instagram',
    restart: 'Create another request',
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
    contactTeam: 'Contacta a nuestro equipo',
    phone: 'WhatsApp',
    instagram: 'Instagram',
    restart: 'Crear otra solicitud',
  },
} as const

export function publicSuccessCopy(locale: QuoteLanguage) {
  return PUBLIC_SUCCESS_COPY[locale]
}
