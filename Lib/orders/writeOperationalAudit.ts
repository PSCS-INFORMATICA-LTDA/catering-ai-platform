import { getSupabaseServerClient } from '@/Lib/supabaseServer'

/**
 * Writer genérico de auditoria operacional para Quotes/Orders, reaproveitando
 * a tabela `audit_logs` já existente (sem novas migrations). Espelha o
 * padrão de `writeAuditLog` em `Lib/orders/convertAcceptedQuoteToServiceOrder.ts`.
 *
 * Nunca lança: falhas de auditoria não podem bloquear o fluxo operacional.
 * Nunca recebe/loga tokens, JWT, senhas ou service-role — apenas ids e
 * campos de negócio (status, categoria, título etc.).
 */
export type OperationalAuditEntityType =
  | 'quote'
  | 'quote_version'
  | 'service_order'
  | 'checklist_item'
  | 'agenda_event'
  | 'operational_team'
  | 'service_order_material'

export type OperationalAuditAction =
  | 'quote_version_created'
  | 'quote_version_accepted'
  | 'checklist_item_created'
  | 'checklist_item_completed'
  | 'checklist_item_reopened'
  | 'checklist_item_skipped'
  | 'team_assignment_designated'
  | 'team_assignment_substituted'
  | 'team_assignment_sent'
  | 'reservation_confirmed'
  | 'team_member_added'
  | 'team_member_removed'
  | 'team_scale_sent'
  | 'team_member_confirmed'
  | 'team_member_declined'
  | 'team_member_substituted'
  | 'schedule_conflict_detected'
  | 'material_created'
  | 'material_updated'
  | 'material_cancelled'
  | 'material_separated'
  | 'material_checked'
  | 'material_divergence'

export async function writeOperationalAudit(input: {
  companyId: string
  actorUserId: string | null
  entityType: OperationalAuditEntityType
  entityId: string
  action: OperationalAuditAction
  oldData?: Record<string, unknown> | null
  newData?: Record<string, unknown> | null
}): Promise<void> {
  const supabase = getSupabaseServerClient()
  try {
    const { error } = await supabase.from('audit_logs').insert({
      company_id: input.companyId,
      user_id: input.actorUserId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      old_data: input.oldData ?? null,
      new_data: input.newData ?? null,
    })
    if (error) {
      console.warn(
        `[Audit] audit_logs indisponível (${input.action}), seguindo sem bloquear:`,
        error.message,
      )
    }
  } catch (err) {
    console.warn(
      `[Audit] audit_logs indisponível (${input.action}), seguindo sem bloquear:`,
      err instanceof Error ? err.message : err,
    )
  }
}
