/**
 * Espelho JS dos helpers Lib/agenda/teamScale.ts (para scripts DEV sem TS).
 */

export const DEFAULT_TEAM_SCALE_REQUIREMENTS = {
  grill_master: 1,
  assistant: 2,
  team_leader: 1,
  preparation: 0,
}

export const TEAM_SCALE_DESIGNATION_ORDER = [
  'grill_master',
  'assistant',
  'assistant',
  'team_leader',
  'preparation',
]

const ROLE_LABELS = {
  team_leader: { pt: 'Líder', en: 'Team Leader', es: 'Líder de Equipo' },
  grill_master: { pt: 'Churrasqueiro', en: 'Grill Master', es: 'Parrillero' },
  assistant: { pt: 'Ajudante', en: 'Assistant', es: 'Ayudante' },
  preparation: { pt: 'Preparação', en: 'Preparation', es: 'Preparación' },
}

export function operationalRoleLabel(roleKey, locale = 'pt') {
  return ROLE_LABELS[roleKey]?.[locale] || roleKey
}

export function countRolesByKey(members) {
  const filled = {
    team_leader: 0,
    grill_master: 0,
    assistant: 0,
    preparation: 0,
  }
  for (const m of members) {
    if (m.active === false) continue
    if (filled[m.role_key] != null) filled[m.role_key] += 1
  }
  return filled
}

export function evaluateTeamScale(
  members,
  requirements = DEFAULT_TEAM_SCALE_REQUIREMENTS,
  locale = 'pt',
) {
  const active = members.filter((m) => m.active !== false)
  const filled = countRolesByKey(active)
  const missing = {}
  for (const key of Object.keys(requirements)) {
    const need = requirements[key]
    const have = filled[key] || 0
    if (have < need) missing[key] = need - have
  }
  const closed = Object.keys(missing).length === 0
  let nextRole = null
  if (!closed) {
    for (const role of TEAM_SCALE_DESIGNATION_ORDER) {
      const need = requirements[role] ?? 0
      if (need <= 0) continue
      if ((filled[role] || 0) < need) {
        nextRole = role
        break
      }
    }
    if (!nextRole) nextRole = Object.keys(missing)[0] || null
  }
  const alerts = []
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

export function designateNextMember(current, person, requirements) {
  const evaluation = evaluateTeamScale(current, requirements)
  if (evaluation.closed || !evaluation.nextRole) {
    return { members: current, evaluation, designatedRole: null }
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
