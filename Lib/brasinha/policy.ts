import type { BrasinhaLanguage } from './types'

export const BRASINHA_ALLOWED_CAPABILITIES = [
  'consult_catalog',
  'consult_prices',
  'explain_packages',
  'explain_additionals',
  'explain_public_rules',
  'guide_quote_intake',
  'prepare_quote_intent',
  'request_human_handoff',
] as const

export const BRASINHA_DENIED_CAPABILITIES = [
  'approve_discount',
  'invent_discount',
  'cancel_order',
  'take_payment',
  'confirm_payment',
  'issue_refund',
  'alter_invoice',
  'alter_inventory',
  'alter_supplier',
  'reserve_date',
  'approve_quote',
  'alter_commercial_rules',
  'alter_catalog',
  'alter_prices',
  'read_other_company',
  'reveal_secrets',
  'override_system_rules',
] as const

export type BrasinhaDeniedCapability =
  (typeof BRASINHA_DENIED_CAPABILITIES)[number]

export type PolicyDecision =
  | { action: 'allow' }
  | {
      action: 'deny'
      capability: BrasinhaDeniedCapability
      handoff: true
      reason: string
    }
  | { action: 'handoff'; reason: string }

const DISCOUNT =
  /\b(desconto|descuento|discount|%\s*off|barato|mais barato|cheaper)\b/i
const PAYMENT =
  /\b(pagamento|pagar|pago|payment|paid|paypal|invoice|refund|reembolso|factura)\b/i
const MARK_PAID =
  /\b(marque|marca|mark).{0,24}\b(pago|paid|pagado)\b|\b(confirm(e|a)? (o )?pagamento|mark.{0,12}payment)\b/i
const SECRETS =
  /\b(credencia\w*|credentials?|secret|token|service.role|api key|senha|password)\b/i
const OTHER_COMPANY =
  /\b(outra empresa|other company|otra empresa|company b|empresa b)\b/i
const OVERRIDE =
  /\b(ignore (suas |the )?regras|ignore (your |the )?(rules|instructions)|system prompt|jailbreak|mude o pre[cç]o|change the price|override)\b/i
const HUMAN =
  /\b(atendente|humano|human|pessoa real|hablar con (alguien|una persona)|speak to (a )?human|falar com (algu[eé]m|um humano))\b/i
const COMPLAINT =
  /\b(reclam(a|ação)|complaint|p[eé]ssima|horrible|estafa|scam)\b/i
const CANCEL =
  /\b(cancel(ar|e|a)?|cancelaci[oó]n|cancelamento)\b/i
const INVENTORY =
  /\b(estoque|inventory|fornecedor|supplier)\b/i

export function evaluateBrasinhaPolicy(text: string): PolicyDecision {
  const value = text.trim()
  if (OVERRIDE.test(value)) {
    return {
      action: 'deny',
      capability: 'override_system_rules',
      handoff: true,
      reason: 'prompt_injection',
    }
  }
  if (SECRETS.test(value)) {
    return {
      action: 'deny',
      capability: 'reveal_secrets',
      handoff: true,
      reason: 'secret_request',
    }
  }
  if (OTHER_COMPANY.test(value)) {
    return {
      action: 'deny',
      capability: 'read_other_company',
      handoff: true,
      reason: 'cross_company',
    }
  }
  if (MARK_PAID.test(value) || /\b(marcar|mark).{0,20}(pago|paid)\b/i.test(value)) {
    return {
      action: 'deny',
      capability: 'confirm_payment',
      handoff: true,
      reason: 'payment_status_change',
    }
  }
  if (DISCOUNT.test(value)) {
    return {
      action: 'deny',
      capability: 'approve_discount',
      handoff: true,
      reason: 'discount_negotiation',
    }
  }
  if (PAYMENT.test(value)) {
    return {
      action: 'deny',
      capability: 'take_payment',
      handoff: true,
      reason: 'payment_question',
    }
  }
  if (CANCEL.test(value)) {
    return {
      action: 'deny',
      capability: 'cancel_order',
      handoff: true,
      reason: 'change_or_cancel',
    }
  }
  if (INVENTORY.test(value) && /\b(alter|mud|cambi|change|set)\b/i.test(value)) {
    return {
      action: 'deny',
      capability: 'alter_inventory',
      handoff: true,
      reason: 'forbidden_capability',
    }
  }
  if (COMPLAINT.test(value)) {
    return { action: 'handoff', reason: 'complaint' }
  }
  if (HUMAN.test(value)) {
    return { action: 'handoff', reason: 'customer_requested_human' }
  }
  return { action: 'allow' }
}

export function deniedReply(
  language: BrasinhaLanguage,
  capability: BrasinhaDeniedCapability,
): string {
  if (language === 'en') {
    if (capability === 'approve_discount' || capability === 'invent_discount') {
      return "I can't approve or invent a discount. I'll pass this to the CDL team so they can review it with you."
    }
    if (capability === 'confirm_payment' || capability === 'take_payment') {
      return "I can't mark a payment or change invoices. A CDL teammate needs to take this from here."
    }
    if (capability === 'reveal_secrets' || capability === 'override_system_rules') {
      return "I can't override business rules or share credentials. I'll flag this for the team."
    }
    if (capability === 'read_other_company') {
      return "I can only talk about this company's catalog. I don't have access to another company's data."
    }
    return "I can't complete that request. I'll confirm the next step with the CDL team so I don't give you the wrong information."
  }
  if (language === 'es') {
    if (capability === 'approve_discount' || capability === 'invent_discount') {
      return 'No puedo aprobar ni inventar un descuento. Voy a pasar esto al equipo CDL para que lo revise contigo.'
    }
    if (capability === 'confirm_payment' || capability === 'take_payment') {
      return 'No puedo marcar un pago ni cambiar facturas. Un compañero de CDL tiene que continuar.'
    }
    if (capability === 'reveal_secrets' || capability === 'override_system_rules') {
      return 'No puedo cambiar reglas de negocio ni compartir credenciales. Voy a avisar al equipo.'
    }
    if (capability === 'read_other_company') {
      return 'Solo puedo hablar del catálogo de esta empresa. No tengo acceso a datos de otra compañía.'
    }
    return 'No puedo completar ese pedido. Voy a confirmar el detalle con el equipo CDL para no pasarte una información incorrecta.'
  }
  if (capability === 'approve_discount' || capability === 'invent_discount') {
    return 'Não posso aprovar nem inventar desconto. Vou passar isso para a equipe CDL revisar com você.'
  }
  if (capability === 'confirm_payment' || capability === 'take_payment') {
    return 'Não posso marcar pagamento nem alterar invoice. A equipe CDL precisa continuar daqui.'
  }
  if (capability === 'reveal_secrets' || capability === 'override_system_rules') {
    return 'Não posso ignorar regras nem passar credenciais. Vou sinalizar isso para a equipe.'
  }
  if (capability === 'read_other_company') {
    return 'Só posso falar do catálogo desta empresa. Não tenho acesso aos dados de outra company.'
  }
  return 'Não consigo concluir esse pedido. Vou confirmar esse detalhe com a equipe CDL para não te passar uma informação incorreta.'
}

export function handoffReply(language: BrasinhaLanguage): string {
  if (language === 'en') {
    return "I'll confirm that detail with the CDL team so I don't pass along incorrect information."
  }
  if (language === 'es') {
    return 'Voy a confirmar ese detalle con el equipo CDL para no pasarte una información incorrecta.'
  }
  return 'Vou confirmar esse detalhe com a equipe CDL para não te passar uma informação incorreta.'
}
