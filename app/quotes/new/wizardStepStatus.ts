import {
  getPackageOptionGroupsForPackage,
  isCustomPackage,
  validatePackageSelections,
} from '@/Lib/packageOptionGroups'
import type { CommercialRulesSnapshot } from '@/Lib/supabaseCommercialRules'
import type { GrillPhotoStatus } from '@/Lib/grillPhotoStatus'
import { isUsablePostalCode } from '@/Lib/cep'
import { isUsablePhone } from '@/Lib/normalizePhone'
import { isUsablePublicPhone } from '@/Lib/publicQuote/phone'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'
import {
  areAllAdditionalCategoriesVisited,
  getAdditionalCategoryReviewProgress,
  getVisibleAdditionalCategoryKeys,
} from '@/Lib/wizardAdditionalCategories'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export const WIZARD_STEP_LABELS = [
  'Cliente',
  'Evento',
  'Pacote',
  'Adicionais',
  'Churrasco',
  'Confirmação',
] as const

function loc(ctx: { language?: QuoteLanguage | string | null }): QuoteLanguage {
  const l = ctx.language
  return l === 'en' || l === 'es' || l === 'pt' ? l : 'pt'
}

function stepLabel(
  ctx: { language?: QuoteLanguage | string | null },
  stepIndex: number,
): string {
  return getQuoteStrings(loc(ctx)).wizardSteps[stepIndex] ?? WIZARD_STEP_LABELS[stepIndex]
}

export const STEPS_COUNT = WIZARD_STEP_LABELS.length

/** Verde = concluído · Atual/pendente · Bloqueado · Vermelho = erro (confirmação) */
export type StepVisualStatus = 'complete' | 'pending' | 'error' | 'locked'

export type WizardStateSnapshot = {
  customerId: string | null
  customerDraftPhone: string
  customerDraftEmail: string
  customerFirstName: string
  customerLastName: string
  eventName: string
  eventDate: string
  startTime: string
  endTime: string
  address: string
  addressNumber: string
  city: string
  state: string
  zipCode: string
  addressPlaceId?: string | null
  addressSource?: 'google' | 'manual' | null
  adultCount: number
  childrenUnder3Count: number
  children4To12Count: number
  hasGrill: boolean
  grillSetupAnswered: boolean
  grillPhotoRequired: boolean
  grillPhotoStatus: GrillPhotoStatus
  grillPhotoAnswered: boolean
  grillPhotoUrl: string | null
  grillPhotoReference?: string | null
  grillRentalRequired: boolean
  grillRentalQty: number
  grillNotes: string
  packageId: string | null
  packageSelections: Record<string, string>
  additionals: Record<string, number>
  baseLocation: string
  distance: number
  freeLimit: number
  rate: number
  reservationPercentage: number
  reservationNotes: string
}

export type StepStatusContext = {
  state: WizardStateSnapshot
  selectedCustomer: { id: string } | null
  selectedPackage: { id: string; package_key?: string | null } | null
  currentStep: number
  reservationAmount: number
  additionalsCount: number
  packageOptionGroups?: ReadonlyArray<
    import('@/Lib/packageOptionGroups').PackageOptionGroupRecord
  >
  packageOptionGroupItems?: ReadonlyArray<
    import('@/Lib/packageOptionGroups').PackageOptionGroupItem
  >
  commercialRules?: CommercialRulesSnapshot
  isEditMode?: boolean
  language?: QuoteLanguage | string | null
  /** Categorias de adicionais que devem ser visitadas (keys). */
  additionalCategoryKeys?: string[]
  additionalCategoryGroups?: ReadonlyArray<{
    categoryKey: string
    items: ReadonlyArray<unknown>
  }>
  visitedAdditionalCategories?: ReadonlySet<string> | string[]
  pricingPreviewReady?: boolean
  /** Public intake accepts a bare 10-digit US number; backoffice still requires a country code. */
  isPublicMode?: boolean
}

function hasUsableContactPhone(ctx: StepStatusContext): boolean {
  return ctx.isPublicMode
    ? isUsablePublicPhone(ctx.state.customerDraftPhone)
    : isUsablePhone(ctx.state.customerDraftPhone)
}

export type PendingStepIssue = {
  stepIndex: number
  label: string
  issues: string[]
}

/** Etapas com validação obrigatória antes do save. */
const MANDATORY_STEP_INDICES = [0, 1, 2, 4] as const

function isFilled(value: string) {
  return value.trim().length > 0
}

function hasLinkedCustomer(ctx: StepStatusContext): boolean {
  if (ctx.isEditMode) return Boolean(ctx.state.customerId)
  if (ctx.selectedCustomer || ctx.state.customerId) return true
  return (
    hasUsableContactPhone(ctx) &&
    isFilled(ctx.state.customerFirstName) &&
    isFilled(ctx.state.customerLastName)
  )
}

function contactIssue(
  language: QuoteLanguage,
  field: 'firstName' | 'lastName' | 'phone' | 'email',
): string {
  const copy = {
    pt: {
      firstName: 'Informe o primeiro nome.',
      lastName: 'Informe o sobrenome.',
      phone: 'Informe um telefone válido com DDI.',
      email: 'Revise o e-mail informado.',
    },
    en: {
      firstName: 'Enter the first name.',
      lastName: 'Enter the last name.',
      phone: 'Enter a valid phone number with country code.',
      email: 'Check the email address.',
    },
    es: {
      firstName: 'Ingresa el nombre.',
      lastName: 'Ingresa el apellido.',
      phone: 'Ingresa un teléfono válido con código de país.',
      email: 'Revisa el correo electrónico.',
    },
  } as const
  return copy[language][field]
}

function allAdditionalCategoriesVisited(ctx: StepStatusContext): boolean {
  const keys =
    ctx.additionalCategoryKeys ??
    getVisibleAdditionalCategoryKeys(ctx.additionalCategoryGroups ?? [])
  return areAllAdditionalCategoriesVisited(keys, ctx.visitedAdditionalCategories)
}

export function isGrillPhotoRequiredAndMissing(
  state: WizardStateSnapshot,
): boolean {
  if (!state.hasGrill) return false
  return (
    state.grillPhotoStatus !== 'received' ||
    (!state.grillPhotoUrl?.trim() && !state.grillPhotoReference?.trim())
  )
}

export function getOperationalStepWarnings(
  ctx: StepStatusContext,
): PendingStepIssue[] {
  return []
}

export function getOptionalStepWarnings(
  ctx: StepStatusContext,
): PendingStepIssue[] {
  const warnings: PendingStepIssue[] = []

  if (!ctx.isEditMode && !hasLinkedCustomer(ctx)) {
    warnings.push({
      stepIndex: 0,
      label: stepLabel(ctx, 0),
      issues: [getQuoteStrings(loc(ctx)).customerNotLinked],
    })
  }

  return warnings
}

function hasValidPackage(ctx: StepStatusContext): boolean {
  if (ctx.selectedPackage) return true
  return Boolean(ctx.state.packageId?.trim())
}

export function getStepIssues(
  stepIndex: number,
  ctx: StepStatusContext,
): string[] {
  const { state } = ctx
  const issues: string[] = []
  const language = loc(ctx)

  switch (stepIndex) {
    case 0:
      if (!ctx.isEditMode && !ctx.selectedCustomer && !state.customerId) {
        if (!isFilled(state.customerFirstName)) {
          issues.push(contactIssue(language, 'firstName'))
        }
        if (!isFilled(state.customerLastName)) {
          issues.push(contactIssue(language, 'lastName'))
        }
        if (!hasUsableContactPhone(ctx)) {
          issues.push(contactIssue(language, 'phone'))
        }
        if (
          state.customerDraftEmail.trim() &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.customerDraftEmail.trim())
        ) {
          issues.push(contactIssue(language, 'email'))
        }
      }
      break
    case 1:
      if (!isFilled(state.eventName)) issues.push(tw(language, 'issueEventName'))
      if (!isFilled(state.eventDate)) issues.push(tw(language, 'issueEventDate'))
      if (!isFilled(state.startTime)) issues.push(tw(language, 'issueStartTime'))
      if (!isFilled(state.endTime)) issues.push(tw(language, 'issueEndTime'))
      if (!isFilled(state.address)) issues.push(tw(language, 'issueAddress'))
      if (
        !ctx.isEditMode &&
        state.addressSource !== 'manual' &&
        !state.addressPlaceId?.trim()
      ) {
        issues.push(
          language === 'en'
            ? 'Select the address from Google suggestions.'
            : language === 'es'
              ? 'Selecciona la dirección en las sugerencias de Google.'
              : 'Selecione o endereço nas sugestões do Google.',
        )
      }
      if (!isFilled(state.city)) issues.push(tw(language, 'issueCity'))
      if (!isFilled(state.state)) issues.push(tw(language, 'issueState'))
      if (!isUsablePostalCode(state.zipCode)) issues.push(tw(language, 'issueZip'))
      if (!(state.adultCount > 0)) {
        issues.push(tw(language, 'issueAdults'))
      }
      break
    case 2: {
      if (!hasValidPackage(ctx)) {
        issues.push(tw(language, 'issueSelectPackage'))
        break
      }
      const packageId = ctx.state.packageId?.trim()
      if (
        packageId &&
        ctx.selectedPackage &&
        !isCustomPackage(ctx.selectedPackage) &&
        ctx.packageOptionGroups
      ) {
        const groups = getPackageOptionGroupsForPackage(
          packageId,
          ctx.packageOptionGroups,
          ctx.packageOptionGroupItems,
        )
        issues.push(
          ...validatePackageSelections(
            groups,
            ctx.state.packageSelections,
            language,
          ),
        )
      }
      break
    }
    case 3: {
      const keys =
        ctx.additionalCategoryKeys ??
        getVisibleAdditionalCategoryKeys(ctx.additionalCategoryGroups ?? [])
      if (
        keys.length > 0 &&
        !areAllAdditionalCategoriesVisited(keys, ctx.visitedAdditionalCategories)
      ) {
        const progress = getAdditionalCategoryReviewProgress(
          keys,
          ctx.visitedAdditionalCategories,
        )
        issues.push(
          tw(language, 'categoriesReviewRequired', {
            remaining: progress.remaining,
            total: progress.total,
          }),
        )
      }
      break
    }
    case 4:
      if (!state.grillSetupAnswered) {
        issues.push(tw(language, 'issueHasGrill'))
      }
      if (isGrillPhotoRequiredAndMissing(state)) {
        issues.push(tw(language, 'grillPendingPhoto'))
      }
      if (state.grillRentalRequired && state.grillRentalQty <= 0) {
        issues.push(tw(language, 'grillPendingRentalQty'))
      }
      break
    case 5:
      if (!areMandatoryStepsComplete(ctx)) {
        issues.push(tw(language, 'issueIncompleteSteps'))
      }
      if (!ctx.pricingPreviewReady) {
        issues.push(tw(language, 'pricingCalcError'))
      }
      break
    default:
      break
  }

  return issues
}

export function isMandatoryStepComplete(
  stepIndex: number,
  ctx: StepStatusContext,
): boolean {
  return getStepIssues(stepIndex, ctx).length === 0
}

export function areMandatoryStepsComplete(ctx: StepStatusContext): boolean {
  return MANDATORY_STEP_INDICES.every((stepIndex) =>
    isMandatoryStepComplete(stepIndex, ctx),
  )
}

export function getMandatoryPendingSteps(
  ctx: StepStatusContext,
): PendingStepIssue[] {
  const indices = [...MANDATORY_STEP_INDICES, 3, 5]
  return indices
    .filter((stepIndex) => !isMandatoryStepComplete(stepIndex, ctx))
    .map((stepIndex) => ({
      stepIndex,
      label: stepLabel(ctx, stepIndex),
      issues: getStepIssues(stepIndex, ctx),
    }))
}

export function isStepContentComplete(
  stepIndex: number,
  ctx: StepStatusContext,
): boolean {
  if (stepIndex === 0) {
    return hasLinkedCustomer(ctx) && getStepIssues(0, ctx).length === 0
  }
  if (stepIndex === 3) {
    return allAdditionalCategoriesVisited(ctx)
  }
  if (stepIndex === 5) {
    return (
      areMandatoryStepsComplete(ctx) &&
      isStepContentComplete(3, ctx) &&
      Boolean(ctx.pricingPreviewReady)
    )
  }
  return getStepIssues(stepIndex, ctx).length === 0
}

/** Primeira etapa ainda inválida, ou a última se 1–5 estiverem válidas. */
export function getMaxReachableStep(ctx: StepStatusContext): number {
  for (let index = 0; index < STEPS_COUNT - 1; index += 1) {
    if (!isStepContentComplete(index, ctx)) return index
  }
  return STEPS_COUNT - 1
}

export function canNavigateToStep(
  stepIndex: number,
  ctx: StepStatusContext,
): boolean {
  if (!Number.isInteger(stepIndex)) return false
  if (stepIndex < 0 || stepIndex >= STEPS_COUNT) return false
  return stepIndex <= getMaxReachableStep(ctx)
}

export function getStepVisualStatus(
  stepIndex: number,
  ctx: StepStatusContext,
): StepVisualStatus {
  if (stepIndex < 0 || stepIndex >= STEPS_COUNT) return 'locked'
  if (stepIndex > getMaxReachableStep(ctx)) return 'locked'

  if (stepIndex === 5) {
    return isStepContentComplete(5, ctx) ? 'complete' : 'pending'
  }

  return isStepContentComplete(stepIndex, ctx) ? 'complete' : 'pending'
}

/** @deprecated Use getStepVisualStatus */
export type StepStatus = 'current' | 'complete' | 'incomplete' | 'empty'

export function isQuoteReadyToSave(ctx: StepStatusContext) {
  return (
    areMandatoryStepsComplete(ctx) &&
    isMandatoryStepComplete(4, ctx) &&
    isMandatoryStepComplete(5, ctx)
  )
}

export function countVisuallyCompleteSteps(ctx: StepStatusContext) {
  let count = 0
  for (let i = 0; i < STEPS_COUNT; i += 1) {
    if (getStepVisualStatus(i, ctx) === 'complete') count += 1
  }
  return count
}

export function countMandatoryPendingSteps(ctx: StepStatusContext) {
  return getMandatoryPendingSteps(ctx).length
}

export function countCompletedSteps(ctx: StepStatusContext) {
  return countVisuallyCompleteSteps(ctx)
}

export function countRemainingSteps(ctx: StepStatusContext) {
  return STEPS_COUNT - countVisuallyCompleteSteps(ctx)
}

export function getCompletionPercentage(ctx: StepStatusContext) {
  return Math.round((countVisuallyCompleteSteps(ctx) / STEPS_COUNT) * 100)
}
