import { WIZARD_STEP_LABELS, WIZARD_STEPS } from './wizardSteps.ts'

export const WIZARD_STEP_SLUGS: Record<string, number> = {
  cliente: WIZARD_STEPS.CLIENT,
  customer: WIZARD_STEPS.CLIENT,
  evento: WIZARD_STEPS.EVENT,
  event: WIZARD_STEPS.EVENT,
  churrasco: WIZARD_STEPS.BBQ,
  churrasqueira: WIZARD_STEPS.BBQ,
  bbq: WIZARD_STEPS.BBQ,
  pacote: WIZARD_STEPS.PACKAGE,
  package: WIZARD_STEPS.PACKAGE,
  adicionais: WIZARD_STEPS.EXTRAS,
  additionals: WIZARD_STEPS.EXTRAS,
  extras: WIZARD_STEPS.EXTRAS,
  confirmacao: WIZARD_STEPS.REVIEW,
  confirmation: WIZARD_STEPS.REVIEW,
  resumo: WIZARD_STEPS.REVIEW,
  summary: WIZARD_STEPS.REVIEW,
}

export const EDIT_WIZARD_DEFAULT_STEP = WIZARD_STEPS.CLIENT

export function resolveWizardStep(
  stepParam?: string | null,
  fallbackStep = WIZARD_STEPS.CLIENT,
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
