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
import {
  WIZARD_STEPS,
  isAdditionalsWizardStep as isAdditionalsStep,
  isGrillWizardStep as isGrillStep,
} from './wizardSteps'

export const WIZARD_STEP_COUNT = 6
export { WIZARD_STEPS }

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
  additionalCategoryKeys: readonly string[] = [],
  visitedAdditionalCategories: ReadonlySet<string> = new Set(),
): boolean {
  void additionalCategoryKeys
  void visitedAdditionalCategories
  return true
}

export function canAdvanceFromWizardStep(ctx: WizardAdvanceContext): boolean {
  switch (ctx.step) {
    case WIZARD_STEPS.CLIENT:
    case WIZARD_STEPS.EVENT:
      return true
    case WIZARD_STEPS.BBQ: {
      if (!ctx.state.grillSetupAnswered) return false
      if (isGrillPhotoRequiredAndMissing(ctx.state)) return false
      if (ctx.state.grillRentalRequired && ctx.state.grillRentalQty <= 0) {
        return false
      }
      return true
    }
    case WIZARD_STEPS.PACKAGE: {
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
    case WIZARD_STEPS.EXTRAS:
      return canAdvanceFromAdditionalsStep(
        ctx.additionalCategoryKeys,
        ctx.visitedAdditionalCategories,
      )
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
  return isGrillStep(step)
}

export function isAdditionalsWizardStep(step: number): boolean {
  return isAdditionalsStep(step)
}
