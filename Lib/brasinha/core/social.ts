export type SocialTurn = 'greeting' | 'thanks' | 'ack' | 'name'

const NAME =
  /^(meu nome [eé]|me chamo|i(?:['’]?m| am)|my name is|me llamo)\b/i
const THANKS = /^(obrigad[oa]s?|valeu|thanks|thank you|gracias)[\s!.,😊]*$/i
const ACK =
  /^(beleza|ok|okay|blz|certo|show|perfeito|legal|ta|t[aá]|yes|yeah|si|s[ií])[\s!.,]*$/i
const GREETING =
  /^(boa (noite|tarde|dia)|oi+|ol[aá]|hey|hi+|hello|e a[ií]|tudo bem|tudo bom)\b/i
const COMMERCIAL =
  /\b(quanto|pacote|pre[cç]o|choice|prime|desconto|cotac|quote|package|price)\b/i

export function detectSocialTurn(text: string): SocialTurn | null {
  const value = text.trim()
  if (!value || value.length > 96) return null
  if (NAME.test(value)) return 'name'
  if (THANKS.test(value)) return 'thanks'
  if (ACK.test(value)) return 'ack'
  if (GREETING.test(value) && !COMMERCIAL.test(value)) return 'greeting'
  return null
}

export function extractCustomerName(text: string): string | null {
  const match = text.match(
    /(?:meu nome [eé]|me chamo|my name is|i(?:['’]?m| am)|me llamo)\s+([A-Za-zÀ-ÿ' -]{2,40})/i,
  )
  const name = match?.[1]?.trim().replace(/[!.?,]+$/, '') ?? ''
  return name || null
}
