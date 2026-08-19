import { getUnvisitedAdditionalCategoryKeys } from './wizardAdditionalCategories'
import {
  isGrillPhotoRequiredAndMissing,
  type WizardStateSnapshot,
} from '../app/quotes/new/wizardStepStatus'
import {
  isCustomPackage,
  validatePackageSelections,
  type PackageOptionGroup,
  type PackageOptionGroupRecord,
} from './packageOptionGroups'
import type { QuoteLanguage } from './quoteWizardTypes'

export const WIZARD_STEP_COUNT = 6

export type WizardAdvanceContext = {
  step: number
  packageId: string | null
  selectedPackage: { id: string; package_key?: string | null } | null
  packageSelections: Record<string, string>
  selectableActivePackageOptionGroups: ReadonlyArray<PackageOptionGroupRecord>
  additionalCategoryKeys: readonly string[]
  visitedAdditionalCategories: ReadonlySet<string>
  state: WizardStateSnapshot
  uiLocale: QuoteLanguage
}

export function getAdditionalsRemainingCategoryKeys(
  additionalCategoryKeys: readonly string[],
  visitedAdditionalCategories: ReadonlySet<string>,
): string[] {
  return getUnvisitedAdditionalCategoryKeys(
    additionalCategoryKeys,
    visitedAdditionalCategories,
  )
}

export function canAdvanceFromAdditionalsStep(
  _additionalCategoryKeys: readonly string[] = [],
  _visitedAdditionalCategories: ReadonlySet<string> = new Set(),
): boolean {
  return true
}

export function canAdvanceFromWizardStep(ctx: WizardAdvanceContext): boolean {
  switch (ctx.step) {
    case 0:
    case 1:
      return true
    case 2: {
      if (!ctx.packageId?.trim()) return false
      if (!ctx.selectedPackage || isCustomPackage(ctx.selectedPackage)) {
        return true
      }
      return (
        validatePackageSelections(
          ctx.selectableActivePackageOptionGroups as PackageOptionGroup[],
          ctx.packageSelections,
          ctx.uiLocale,
        ).length === 0
      )
    }
    case 3:
      return canAdvanceFromAdditionalsStep(
        ctx.additionalCategoryKeys,
        ctx.visitedAdditionalCategories,
      )
    case 4: {
      if (!ctx.state.grillSetupAnswered) return false
      if (isGrillPhotoRequiredAndMissing(ctx.state)) return false
      if (ctx.state.grillRentalRequired && ctx.state.grillRentalQty <= 0) {
        return false
      }
      return true
    }
    default:
      return ctx.step < WIZARD_STEP_COUNT - 1
  }
}

/** Próximo índice de etapa após validar guards; retorna step atual se bloqueado. */
export function resolveNextWizardStep(ctx: WizardAdvanceContext): number {
  if (!canAdvanceFromWizardStep(ctx)) return ctx.step
  if (ctx.step >= WIZARD_STEP_COUNT - 1) return ctx.step
  return ctx.step + 1
}

export function isGrillWizardStep(step: number): boolean {
  return step === 4
}

export function isAdditionalsWizardStep(step: number): boolean {
  return step === 3
}
