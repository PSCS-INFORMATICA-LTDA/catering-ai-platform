import type { BrasinhaLanguage } from './types'

const ES_MARKERS =
  /\b(qué|que|paquetes|paquete|cotizaci[oó]n|quiero|tienen|cu[aá]nto|parrilla|mozo|descuento)\b/i
const EN_MARKERS =
  /\b(what|which|packages?|offer|need|quote|how much|grill|waiter|discount|price)\b/i
const PT_MARKERS =
  /\b(quais|pacotes?|quanto|custa|churrasco|churrasqueira|gar[cç]om|desconto|quero|tem)\b/i

export function detectBrasinhaLanguage(
  text: string,
  fallback: BrasinhaLanguage = 'pt',
): BrasinhaLanguage {
  const value = text.trim()
  if (!value) return fallback
  const es = ES_MARKERS.test(value)
  const en = EN_MARKERS.test(value)
  const pt = PT_MARKERS.test(value)
  if (es && !en && !pt) return 'es'
  if (en && !es && !pt) return 'en'
  if (pt && !es) return 'pt'
  if (es && /[¿¡áéíóúñ]/i.test(value)) return 'es'
  if (en && !/[ãõçáéíóú]/i.test(value)) return 'en'
  return fallback
}
