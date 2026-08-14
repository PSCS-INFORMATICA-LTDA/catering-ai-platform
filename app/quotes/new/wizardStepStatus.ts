import {
  getPackageOptionGroupsForPackage,
  isCustomPackage,
  validatePackageSelections,
} from '@/Lib/packageOptionGroups'
import {
  getFallbackCommercialRules,
  type CommercialRulesSnapshot,
} from '@/Lib/supabaseCommercialRules'
import type { GrillPhotoStatus } from '@/Lib/grillPhotoStatus'
import { isUsablePostalCode } from '@/Lib/cep'
import { isUsablePhone } from '@/Lib/normalizePhone'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'
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

/** Verde = concluído · Amarelo = pendente · Vermelho = erro (confirmação) */
export type StepVisualStatus = 'complete' | 'pending' | 'error'

export type WizardStateSnapshot = {
  customerId: string | null
  customerDraftPhone: string
  eventName: string
  eventDate: string
  startTime: string
  endTime: string
  address: string
  city: string
  state: string
  zipCode: string
  adultCount: number
  childrenUnder3Count: number
  children4To12Count: number
  hasGrill: boolean
  grillSetupAnswered: boolean
  grillPhotoRequired: boolean
  grillPhotoStatus: GrillPhotoStatus
  grillPhotoAnswered: boolean
  grillPhotoUrl: string | null
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
  visitedAdditionalCategories?: ReadonlySet<string> | string[]
  pricingPreviewReady?: boolean
}

export type PendingStepIssue = {
  stepIndex: number
  label: string
  issues: string[]
}

/** Etapas com validação obrigatória antes do save. */
const MANDATORY_STEP_INDICES = [1, 2, 4] as const

function isFilled(value: string) {
  return value.trim().length > 0
}

function hasLinkedCustomer(ctx: StepStatusContext): boolean {
  if (ctx.isEditMode) return Boolean(ctx.state.customerId)
  if (ctx.selectedCustomer || ctx.state.customerId) return true
  return isUsablePhone(ctx.state.customerDraftPhone)
}

function allAdditionalCategoriesVisited(ctx: StepStatusContext): boolean {
  const keys = ctx.additionalCategoryKeys ?? []
  if (keys.length === 0) return true
  const visited =
    ctx.visitedAdditionalCategories instanceof Set
      ? ctx.visitedAdditionalCategories
      : new Set(ctx.visitedAdditionalCategories ?? [])
  return keys.every((key) => visited.has(key))
}

export function isGrillPhotoRequiredAndMissing(
  state: WizardStateSnapshot,
): boolean {
  if (!state.hasGrill) return false
  return state.grillPhotoStatus !== 'received' || !state.grillPhotoUrl?.trim()
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
  const { state, selectedPackage } = ctx
  const issues: string[] = []
  const language = loc(ctx)

  switch (stepIndex) {
    case 0:
      break
    case 1:
      if (!isFilled(state.eventName)) issues.push(tw(language, 'issueEventName'))
      if (!isFilled(state.eventDate)) issues.push(tw(language, 'issueEventDate'))
      if (!isFilled(state.startTime)) issues.push(tw(language, 'issueStartTime'))
      if (!isFilled(state.endTime)) issues.push(tw(language, 'issueEndTime'))
      if (!isFilled(state.address)) issues.push(tw(language, 'issueAddress'))
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
    case 3:
      if (!allAdditionalCategoriesVisited(ctx)) {
        issues.push(tw(language, 'categoriesReviewRequired'))
      }
      break
    case 4:
      if (!state.grillSetupAnswered) {
        issues.push(tw(language, 'issueHasGrill'))
      }
      if (isGrillPhotoRequiredAndMissing(state)) {
        issues.push(tw(language, 'grillPhotoRequiredError'))
      }
      if (state.grillRentalRequired && state.grillRentalQty <= 0) {
        issues.push(tw(language, 'issueGrillQty'))
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

export function getStepVisualStatus(
  stepIndex: number,
  ctx: StepStatusContext,
): StepVisualStatus {
  if (stepIndex === 5) {
    return isMandatoryStepComplete(5, ctx) && ctx.pricingPreviewReady
      ? 'complete'
      : 'error'
  }

  if (stepIndex === 0) {
    return hasLinkedCustomer(ctx) ? 'complete' : 'pending'
  }

  if (stepIndex === 3) {
    return allAdditionalCategoriesVisited(ctx) ? 'complete' : 'pending'
  }

  return isMandatoryStepComplete(stepIndex, ctx) ? 'complete' : 'pending'
}

/** @deprecated Use getStepVisualStatus */
export type StepStatus = 'current' | 'complete' | 'incomplete' | 'empty'

export function isQuoteReadyToSave(ctx: StepStatusContext) {
  return (
    areMandatoryStepsComplete(ctx) &&
    allAdditionalCategoriesVisited(ctx) &&
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
