import type { QuoteLanguage } from './quoteWizardTypes'

/** Official CDL 2026 included service — buffet tables + rechauds + disposables. */
export const INCLUDED_SERVICE_COPY = {
  pt: {
    title: 'INCLUÍDO NO SERVIÇO',
    body: 'Estrutura de mesas do buffet com rechauds e descartáveis: pratos, talheres e guardanapos.',
  },
  en: {
    title: 'INCLUDED IN THE SERVICE',
    body: 'Buffet table setup with chafing dishes and disposables: plates, cutlery and napkins.',
  },
  es: {
    title: 'INCLUIDO EN EL SERVICIO',
    body: 'Estructura de mesas de buffet con chafing dishes y desechables: platos, cubiertos y servilletas.',
  },
} as const

export function getIncludedServiceCopy(
  language: QuoteLanguage | string | null | undefined,
) {
  if (language === 'en' || language === 'es') return INCLUDED_SERVICE_COPY[language]
  return INCLUDED_SERVICE_COPY.pt
}
