/**
 * Escala operacional da equipe para um evento.
 *
 * Ordem sugerida de designação (Philippe):
 * 1) Churrasqueiro (grill_master)
 * 2) Ajudantes (assistant)
 * 3) Líder (team_leader) — fecha a equipe
 * 4) Preparação (opcional)
 *
 * "Equipe fechada" = requisitos mínimos atendidos.
 */

import {
  isOperationalRoleKey,
  operationalRoleLabel,
  type OperationalRoleKey,
} from '@/Lib/agenda/operationalRoles'

export type TeamScaleRequirements = Record<OperationalRoleKey, number>

/** Requisitos padrão CDL/DEV para fechar a escala de um evento. */
export const DEFAULT_TEAM_SCALE_REQUIREMENTS: TeamScaleRequirements = {
  grill_master: 1,
  assistant: 2,
  team_leader: 1,
  preparation: 0,
}

/** Ordem em que o operador deve designar (churrasqueiro → ajudantes → líder). */
export const TEAM_SCALE_DESIGNATION_ORDER: OperationalRoleKey[] = [
  'grill_master',
  'assistant',
  'assistant',
  'team_leader',
  'preparation',
]

export type ScaleMember = {
  person_id: string
  role_key: string
  active?: boolean
  person_name?: string | null
}

export type TeamScaleEvaluation = {
  closed: boolean
  requirements: TeamScaleRequirements
  filled: TeamScaleRequirements
  missing: Partial<Record<OperationalRoleKey, number>>
  /** Próxima função a designar (null se fechada ou só opcionais). */
  nextRole: OperationalRoleKey | null
  nextRoleLabel: string | null
  members: ScaleMember[]
  alerts: string[]
}

function emptyCounts(): TeamScaleRequirements {
  return {
    team_leader: 0,
    grill_master: 0,
    assistant: 0,
    preparation: 0,
  }
}

export function countRolesByKey(
  members: ScaleMember[],
): TeamScaleRequirements {
  const filled = emptyCounts()
  for (const m of members) {
    if (m.active === false) continue
    if (!isOperationalRoleKey(m.role_key)) continue
    filled[m.role_key] += 1
  }
  return filled
}

export function evaluateTeamScale(
  members: ScaleMember[],
  requirements: TeamScaleRequirements = DEFAULT_TEAM_SCALE_REQUIREMENTS,
  locale: 'pt' | 'en' | 'es' = 'pt',
): TeamScaleEvaluation {
  const active = members.filter((m) => m.active !== false)
  const filled = countRolesByKey(active)
  const missing: Partial<Record<OperationalRoleKey, number>> = {}
  const alerts: string[] = []

  for (const key of Object.keys(requirements) as OperationalRoleKey[]) {
    const need = requirements[key]
    const have = filled[key]
    if (have < need) missing[key] = need - have
  }

  const closed = Object.keys(missing).length === 0

  let nextRole: OperationalRoleKey | null = null
  if (!closed) {
    for (const role of TEAM_SCALE_DESIGNATION_ORDER) {
      const need = requirements[role] ?? 0
      if (need <= 0) continue
      if (filled[role] < need) {
        nextRole = role
        break
      }
    }
    // fallback: qualquer papel faltante
    if (!nextRole) {
      nextRole = (Object.keys(missing)[0] as OperationalRoleKey) || null
    }
  }

  if (active.length === 0) alerts.push('SEM EQUIPE')
  else if (!closed) alerts.push('EQUIPE INCOMPLETA')
  else alerts.push('EQUIPE FECHADA')

  return {
    closed,
    requirements,
    filled,
    missing,
    nextRole,
    nextRoleLabel: nextRole ? operationalRoleLabel(nextRole, locale) : null,
    members: active,
    alerts,
  }
}

/** Slot de escala para seleção na OS (churrasqueiro, ajudante 1/2, líder…). */
export type TeamScaleSlotDef = {
  slotKey: string
  role_key: OperationalRoleKey
  label: string
  index: number
}

/** Monta slots a partir dos requisitos (ordem: churrasqueiro → ajudantes → líder). */
export function buildTeamScaleSlots(
  requirements: TeamScaleRequirements = DEFAULT_TEAM_SCALE_REQUIREMENTS,
  locale: 'pt' | 'en' | 'es' = 'pt',
): TeamScaleSlotDef[] {
  const order: OperationalRoleKey[] = [
    'grill_master',
    'assistant',
    'team_leader',
    'preparation',
  ]
  const slots: TeamScaleSlotDef[] = []
  for (const role of order) {
    const need = requirements[role] ?? 0
    for (let i = 0; i < need; i++) {
      const base = operationalRoleLabel(role, locale)
      slots.push({
        slotKey: `${role}:${i}`,
        role_key: role,
        label: need > 1 ? `${base} ${i + 1}` : base,
        index: i,
      })
    }
  }
  return slots
}

/**
 * Simula designação passo a passo (útil em testes/seed).
 * Retorna a lista após cada adição e a avaliação.
 */
export function designateNextMember(
  current: ScaleMember[],
  person: { person_id: string; person_name?: string | null },
  requirements: TeamScaleRequirements = DEFAULT_TEAM_SCALE_REQUIREMENTS,
): { members: ScaleMember[]; evaluation: TeamScaleEvaluation; designatedRole: OperationalRoleKey | null } {
  const evaluation = evaluateTeamScale(current, requirements)
  if (evaluation.closed || !evaluation.nextRole) {
    return {
      members: current,
      evaluation,
      designatedRole: null,
    }
  }
  const members = [
    ...current,
    {
      person_id: person.person_id,
      person_name: person.person_name ?? null,
      role_key: evaluation.nextRole,
      active: true,
    },
  ]
  return {
    members,
    evaluation: evaluateTeamScale(members, requirements),
    designatedRole: evaluation.nextRole,
  }
}
