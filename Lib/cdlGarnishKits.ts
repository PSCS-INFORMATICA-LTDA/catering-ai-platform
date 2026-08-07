/**
 * Compat: preset CDL + helpers.
 * Fonte de verdade multiempresa: commercial_rules.supplier_garnish_kit_packing
 * (`Lib/supplierGarnishKitRule.ts`).
 */

export {
  CDL_SUPPLIER_GARNISH_KIT_CONFIG,
  SUPPLIER_GARNISH_KIT_RULE_KEY,
  computeGarnishKitsFromConfig,
  isKitCoveredSideLabel as isCdlKitCoveredSideLabel,
  labelForGarnishKitItem as labelForCdlGarnishKitItem,
  parseSupplierGarnishKitConfig,
  toSupplierGarnishCdlKitsInput,
  type GarnishKitItem as CdlGarnishKitItem,
  type GarnishKitItemKey as CdlGarnishKitItemKey,
  type GarnishKitResult as CdlGarnishKitResult,
  type SupplierGarnishKitConfig,
} from './supplierGarnishKitRule'

import {
  CDL_SUPPLIER_GARNISH_KIT_CONFIG,
  computeGarnishKitsFromConfig,
  type GarnishKitResult,
} from './supplierGarnishKitRule'

/** @deprecated Use computeGarnishKitsFromConfig(config from commercial_rules). */
export function computeCdlGarnishKits(input: {
  hasGarnish: boolean
  totalPeople: number | null | undefined
  adultCount?: number | null | undefined
}): GarnishKitResult {
  return computeGarnishKitsFromConfig(CDL_SUPPLIER_GARNISH_KIT_CONFIG, input)
}

export function computeCdlLargeGarnishKits(
  hasGarnish: boolean,
  totalPeople: number,
): number {
  return computeCdlGarnishKits({ hasGarnish, totalPeople }).largeKits
}

export function computeCdlSmallGarnishKits(
  hasGarnish: boolean,
  totalPeople: number,
): number {
  return computeCdlGarnishKits({ hasGarnish, totalPeople }).smallKits
}
