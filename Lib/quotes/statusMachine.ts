/**
 * Máquina de status da cotação (spec §E).
 *
 * Estados canônicos:
 *   draft → ready_for_review → sent → viewed → accepted → converted
 *   paralelos: rejected, expired, cancelled, archived
 *
 * `quotes.quote_status` continua varchar livre (sem CHECK) — aliases legados
 * (`approved`, `canceled`) são aceitos na leitura para compatibilidade.
 */

export type CanonicalQuoteStatus =
  | 'draft'
  | 'ready_for_review'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'converted'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'archived'

const LEGACY_ALIASES: Record<string, CanonicalQuoteStatus> = {
  approved: 'accepted',
  canceled: 'cancelled',
}

const CANONICAL_STATUSES: CanonicalQuoteStatus[] = [
  'draft',
  'ready_for_review',
  'sent',
  'viewed',
  'accepted',
  'converted',
  'rejected',
  'expired',
  'cancelled',
  'archived',
]

/** Normaliza status legado/livre para a chave técnica canônica. */
export function normalizeQuoteStatus(
  status: string | null | undefined,
): CanonicalQuoteStatus {
  const raw = (status ?? '').trim().toLowerCase()
  if (!raw) return 'draft'
  if (LEGACY_ALIASES[raw]) return LEGACY_ALIASES[raw]
  if ((CANONICAL_STATUSES as string[]).includes(raw)) {
    return raw as CanonicalQuoteStatus
  }
  return 'draft'
}

/** Transições permitidas a partir de cada status canônico. */
const ALLOWED_TRANSITIONS: Record<CanonicalQuoteStatus, CanonicalQuoteStatus[]> = {
  draft: ['ready_for_review', 'sent', 'cancelled', 'archived'],
  ready_for_review: ['sent', 'draft', 'cancelled', 'archived'],
  sent: ['viewed', 'accepted', 'rejected', 'expired', 'cancelled'],
  viewed: ['accepted', 'rejected', 'expired', 'cancelled'],
  accepted: ['converted', 'cancelled'],
  converted: ['archived'],
  rejected: ['sent', 'archived'],
  expired: ['sent', 'archived'],
  cancelled: ['archived'],
  archived: [],
}

export function isValidQuoteTransition(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  const fromCanonical = normalizeQuoteStatus(from)
  const toCanonical = normalizeQuoteStatus(to)
  if (fromCanonical === toCanonical) return true
  return ALLOWED_TRANSITIONS[fromCanonical]?.includes(toCanonical) ?? false
}

export function isQuoteAccepted(input: {
  quote_status?: string | null
  proposal_response?: string | null
}): boolean {
  if (input.proposal_response === 'accepted') return true
  return normalizeQuoteStatus(input.quote_status) === 'accepted'
}

export function isQuoteConverted(input: {
  quote_status?: string | null
  converted_service_order_id?: string | null
}): boolean {
  if (input.converted_service_order_id) return true
  return normalizeQuoteStatus(input.quote_status) === 'converted'
}

export function canConvertQuote(input: {
  quote_status?: string | null
  proposal_response?: string | null
  converted_service_order_id?: string | null
  active?: boolean | null
}): { ok: boolean; reason: string | null } {
  if (input.active === false) {
    return { ok: false, reason: 'Cotação inativa.' }
  }
  if (isQuoteConverted(input)) {
    return { ok: false, reason: 'Cotação já convertida em Ordem de Serviço.' }
  }
  if (!isQuoteAccepted(input)) {
    return {
      ok: false,
      reason:
        'A cotação precisa estar aceita pelo cliente antes de converter em Ordem de Serviço.',
    }
  }
  return { ok: true, reason: null }
}
