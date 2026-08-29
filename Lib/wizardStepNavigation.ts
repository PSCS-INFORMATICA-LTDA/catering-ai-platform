import { WIZARD_STEP_LABELS } from '@/app/quotes/new/wizardStepStatus'

export const WIZARD_STEP_SLUGS: Record<string, number> = {
  cliente: 0,
  customer: 0,
  evento: 1,
  event: 1,
  churrasco: 2,
  churrasqueira: 2,
  bbq: 2,
  pacote: 3,
  package: 3,
  adicionais: 4,
  additionals: 4,
  extras: 4,
  confirmacao: 5,
  confirmation: 5,
  resumo: 5,
  summary: 5,
}

export const EDIT_WIZARD_DEFAULT_STEP = 0

export function resolveWizardStep(
  stepParam?: string | null,
  fallbackStep = 0,
): number {
  if (!stepParam?.trim()) return fallbackStep

  const normalized = stepParam.trim().toLowerCase()
  const bySlug = WIZARD_STEP_SLUGS[normalized]
  if (bySlug != null) return bySlug

  const numeric = Number.parseInt(normalized, 10)
  if (
    Number.isFinite(numeric) &&
    numeric >= 0 &&
    numeric < WIZARD_STEP_LABELS.length
  ) {
    return numeric
  }

  return fallbackStep
}
