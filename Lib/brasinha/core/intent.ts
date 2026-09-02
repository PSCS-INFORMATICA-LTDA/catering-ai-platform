export type BrasinhaIntent =
  | 'list_packages'
  | 'package_details'
  | 'grill_rental'
  | 'waiter'
  | 'catalog_search'
  | 'public_rules'
  | 'quote_intent'
  | 'quote_status'
  | 'unknown'

const LIST_PACKAGES =
  /\b(quais pacotes|que pacotes|what (bbq )?packages|packages do you offer|qu[eé] paquetes|paquetes tienen)\b/i
const PACKAGE_PRICE =
  /\b(quanto custa|how much|cu[aá]nto (cuesta|vale)|pre[cç]o|precio|price)\b/i
const TRADITIONAL = /\b(traditional|tradicional)\b/i
const GRILL =
  /\b(churrasqueira|alugam? churrasqueira|grill rental|rent(al)? (a )?grill|parrilla)\b/i
const WAITER = /\b(gar[cç]om|waiter|mozo|garcon)\b/i
const QUOTE_INTENT =
  /\b(quero churrasco|need bbq|bbq for \d+|cotiza|cotiza[cç][aã]o|quote for \d+|para \d+ pessoas|para \d+ personas|for \d+ people)\b/i
const QUOTE_STATUS = /\b(q-\d{4}-\d+|proposta|proposal token|status da cota[cç][aã]o)\b/i
const RULES = /\b(regras|rules|m[ií]nimo|minimum order|mileage|milhas)\b/i
const SEARCH = /\b(picanha|farofa|lingui[cç]a|salm[aã]o|costela|adicional|extra)\b/i

export function detectBrasinhaIntent(text: string): BrasinhaIntent {
  const value = text.trim()
  if (QUOTE_STATUS.test(value)) return 'quote_status'
  if (GRILL.test(value)) return 'grill_rental'
  if (WAITER.test(value)) return 'waiter'
  if (LIST_PACKAGES.test(value)) return 'list_packages'
  if (PACKAGE_PRICE.test(value) || TRADITIONAL.test(value)) return 'package_details'
  if (QUOTE_INTENT.test(value)) return 'quote_intent'
  if (RULES.test(value)) return 'public_rules'
  if (SEARCH.test(value)) return 'catalog_search'
  return 'unknown'
}

export function extractGuestCount(text: string): number | null {
  const match = text.match(/\b(\d{1,3})\b/)
  if (!match) return null
  const count = Number(match[1])
  return Number.isInteger(count) && count >= 1 && count <= 500 ? count : null
}

export function extractPackageQuery(text: string): string {
  if (/\b(traditional|tradicional)\b/i.test(text)) return 'Traditional'
  if (/\b(select|sele[cç][aã]o)\b/i.test(text)) return 'Select'
  if (/\b(choice|escolha)\b/i.test(text)) return 'Choice'
  if (/\b(prime)\b/i.test(text)) return 'Prime'
  if (/\b(luxury|luxo)\b/i.test(text)) return 'Luxury'
  return text
}
