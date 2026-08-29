/** Canonical public/backoffice quote wizard indices. Six steps, no seventh. */
export const WIZARD_STEPS = {
  CLIENT: 0,
  EVENT: 1,
  BBQ: 2,
  PACKAGE: 3,
  EXTRAS: 4,
  REVIEW: 5,
} as const

export type WizardStepIndex = (typeof WIZARD_STEPS)[keyof typeof WIZARD_STEPS]

export const WIZARD_STEP_COUNT = 6

export const WIZARD_STEP_LABELS = [
  'Cliente',
  'Evento',
  'Churrasco',
  'Pacote',
  'Adicionais',
  'Confirmação',
] as const

export const MANDATORY_WIZARD_STEP_INDICES = [
  WIZARD_STEPS.CLIENT,
  WIZARD_STEPS.EVENT,
  WIZARD_STEPS.BBQ,
  WIZARD_STEPS.PACKAGE,
] as const

export function isGrillWizardStep(step: number): boolean {
  return step === WIZARD_STEPS.BBQ
}

export function isPackageWizardStep(step: number): boolean {
  return step === WIZARD_STEPS.PACKAGE
}

export function isAdditionalsWizardStep(step: number): boolean {
  return step === WIZARD_STEPS.EXTRAS
}

export function isReviewWizardStep(step: number): boolean {
  return step === WIZARD_STEPS.REVIEW
}
