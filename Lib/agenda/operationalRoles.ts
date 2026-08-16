/** Funções operacionais da Pessoa — rótulos no app (não no banco). */

export const OPERATIONAL_ROLE_KEYS = [
  'team_leader',
  'grill_master',
  'assistant',
  'preparation',
] as const

export type OperationalRoleKey = (typeof OPERATIONAL_ROLE_KEYS)[number]

export function isOperationalRoleKey(value: string): value is OperationalRoleKey {
  return (OPERATIONAL_ROLE_KEYS as readonly string[]).includes(value)
}

export type OperationalRoleLabels = {
  pt: string
  en: string
  es: string
}

export const OPERATIONAL_ROLE_LABELS: Record<
  OperationalRoleKey,
  OperationalRoleLabels
> = {
  team_leader: {
    pt: 'Líder',
    en: 'Team Leader',
    es: 'Líder de Equipo',
  },
  grill_master: {
    pt: 'Churrasqueiro',
    en: 'Grill Master',
    es: 'Parrillero',
  },
  assistant: {
    pt: 'Ajudante',
    en: 'Assistant',
    es: 'Ayudante',
  },
  preparation: {
    pt: 'Preparação',
    en: 'Preparation',
    es: 'Preparación',
  },
}

export function operationalRoleLabel(
  roleKey: string,
  locale: 'pt' | 'en' | 'es' = 'pt',
): string {
  if (!isOperationalRoleKey(roleKey)) return roleKey
  return OPERATIONAL_ROLE_LABELS[roleKey][locale]
}
