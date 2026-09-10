import type { BrasinhaCatalogPort, PackageSummary } from '../tools/types.ts'

/** Mirrors Lib/grillRental.ts — rental qty is never customer-invented. */
function normalizeGrillRentalQty(required: boolean): 0 | 1 {
  return required ? 1 : 0
}

function resolveGrillRentalFromSite(
  hasGrill: boolean | null | undefined,
): { required: boolean; qty: 0 | 1 } | null {
  if (hasGrill === true) return { required: false, qty: 0 }
  if (hasGrill === false) return { required: true, qty: 1 }
  return null
}
import {
  cloneQuoteDraft,
  type BrasinhaQuoteDraft,
  type OfferedPackage,
} from './draft.ts'
import { refreshDraftStage } from './stage.ts'

export type IntakePatch = {
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  email?: string | null
  eventDate?: string | null
  startTime?: string | null
  adultCount?: number | null
  childrenUnder3Count?: number | null
  children4To12Count?: number | null
  childrenZeroAll?: boolean
  address?: string | null
  formattedAddress?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  inventAddress?: boolean
  packageQuery?: string | null
  packageId?: string | null
  packageKey?: string | null
  packagePrice?: number | null
  confirmPackage?: boolean
  optionGroupId?: string | null
  optionItemId?: string | null
  additionalItemId?: string | null
  additionalItemKey?: string | null
  additionalQty?: number | null
  additionalBlockedReason?: string | null
  hasGrill?: boolean | null
  waiterQty?: number | null
  waiterAsked?: boolean
  disposableKitQty?: number | null
  requiredOptionGroupIds?: string[]
  confirmReview?: boolean
}

export type IntakeApplyResult = {
  draft: BrasinhaQuoteDraft
  rejected: string | null
  notes: string[]
}

function filled(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function rememberOffered(draft: BrasinhaQuoteDraft, packages: OfferedPackage[]) {
  const next = [...draft.conversation.lastOfferedPackages]
  for (const pkg of packages) {
    const index = next.findIndex((row) => row.id === pkg.id)
    if (index >= 0) next[index] = pkg
    else next.push(pkg)
  }
  draft.conversation.lastOfferedPackages = next
}

export function rememberOfferedPackages(
  draft: BrasinhaQuoteDraft,
  packages: Array<PackageSummary | OfferedPackage>,
): BrasinhaQuoteDraft {
  const next = cloneQuoteDraft(draft)
  rememberOffered(
    next,
    packages.map((pkg) => ({
      id: pkg.id,
      packageKey: pkg.packageKey ?? null,
      label: pkg.label,
      pricePerPerson: pkg.pricePerPerson ?? null,
    })),
  )
  return next
}

function matchOffered(
  draft: BrasinhaQuoteDraft,
  input: { packageId?: string | null; packageKey?: string | null; packageQuery?: string | null; packagePrice?: number | null },
): OfferedPackage | 'ambiguous' | null {
  const offered = draft.conversation.lastOfferedPackages
  if (input.packageId) {
    return offered.find((row) => row.id === input.packageId) ?? null
  }
  if (input.packageKey) {
    const key = input.packageKey.trim().toLowerCase()
    return (
      offered.find((row) => row.packageKey?.toLowerCase() === key) ?? null
    )
  }
  if (input.packagePrice != null) {
    const matches = offered.filter(
      (row) => row.pricePerPerson != null && Math.abs(row.pricePerPerson - input.packagePrice!) < 0.02,
    )
    if (matches.length === 1) return matches[0]!
    if (matches.length > 1) return 'ambiguous'
  }
  const query = filled(input.packageQuery)
  if (!query) return null
  if (/^\d+([.,]\d+)?$/.test(query)) {
    const price = Number(query.replace(',', '.'))
    return matchOffered(draft, { packagePrice: price })
  }
  const needle = query.toLowerCase()
  const matches = offered.filter((row) => {
    const key = row.packageKey?.toLowerCase() ?? ''
    const label = row.label.toLowerCase()
    return label.includes(needle) || needle.includes(label) || key.includes(needle)
  })
  if (matches.length === 1) return matches[0]!
  if (matches.length > 1) return 'ambiguous'
  return null
}

function applyGrill(draft: BrasinhaQuoteDraft, hasGrill: boolean) {
  const rental = resolveGrillRentalFromSite(hasGrill)
  draft.grill.setupAnswered = true
  draft.grill.hasGrill = hasGrill
  draft.grill.rentalRequired = rental?.required ?? false
  draft.grill.rentalQty = rental ? rental.qty : normalizeGrillRentalQty(false)
  draft.grill.photoStatus = hasGrill ? 'pending' : 'not_applicable'
  draft.grill.photoReference = null
}

export function applyQuoteIntakePatch(
  current: BrasinhaQuoteDraft,
  patch: IntakePatch,
): IntakeApplyResult {
  const draft = cloneQuoteDraft(current)
  const notes: string[] = []
  if (patch.inventAddress) {
    return {
      draft: refreshDraftStage(current),
      rejected: 'address_must_be_real',
      notes: ['Não invente endereço. Peça um local real ou pelo menos a cidade.'],
    }
  }

  const firstName = filled(patch.firstName)
  const lastName = filled(patch.lastName)
  if (firstName) draft.contact.firstName = firstName
  if (lastName) draft.contact.lastName = lastName
  const phone = filled(patch.phone)
  if (phone) draft.contact.phone = phone
  const email = filled(patch.email)
  if (email) draft.contact.email = email

  const eventDate = filled(patch.eventDate)
  if (eventDate) draft.event.eventDate = eventDate
  const startTime = filled(patch.startTime)
  if (startTime) draft.event.startTime = startTime
  if (typeof patch.adultCount === 'number' && Number.isInteger(patch.adultCount) && patch.adultCount >= 0) {
    draft.event.adultCount = patch.adultCount
  }
  const under3Explicit =
    typeof patch.childrenUnder3Count === 'number' && Number.isInteger(patch.childrenUnder3Count)
  const over4Explicit =
    typeof patch.children4To12Count === 'number' && Number.isInteger(patch.children4To12Count)
  if (patch.childrenZeroAll) {
    draft.event.childrenUnder3Count = 0
    draft.event.children4To12Count = 0
    if (under3Explicit || over4Explicit) {
      draft.event.childrenBandsConfirmed = true
      if (draft.conversation.pendingAction?.type === 'confirm_children_bands') {
        draft.conversation.pendingAction = null
      }
    } else {
      draft.conversation.pendingAction = { type: 'confirm_children_bands' }
      notes.push('Confirme as duas faixas de crianças antes de seguir.')
    }
  }
  if (under3Explicit) {
    draft.event.childrenUnder3Count = Math.max(0, patch.childrenUnder3Count!)
  }
  if (over4Explicit) {
    draft.event.children4To12Count = Math.max(0, patch.children4To12Count!)
  }
  if (under3Explicit && over4Explicit) {
    draft.event.childrenBandsConfirmed = true
    if (draft.conversation.pendingAction?.type === 'confirm_children_bands') {
      draft.conversation.pendingAction = null
    }
  } else if (
    draft.event.childrenUnder3Count != null &&
    draft.event.children4To12Count != null &&
    draft.conversation.pendingAction?.type !== 'confirm_children_bands'
  ) {
    draft.event.childrenBandsConfirmed = true
  }

  const address = filled(patch.address)
  if (address) draft.event.address = address
  const formatted = filled(patch.formattedAddress)
  if (formatted) draft.event.formattedAddress = formatted
  const city = filled(patch.city)
  if (city) draft.event.city = city
  const state = filled(patch.state)
  if (state) draft.event.state = state
  const zip = filled(patch.zipCode)
  if (zip) draft.event.zipCode = zip

  if (Array.isArray(patch.requiredOptionGroupIds)) {
    draft.package.requiredOptionGroupIds = patch.requiredOptionGroupIds.filter(Boolean)
  }

  const offered = matchOffered(draft, patch)
  if (offered === 'ambiguous') {
    return {
      draft: refreshDraftStage(draft),
      rejected: 'package_ambiguous',
      notes: ['Há mais de um pacote com esse preço/nome. Pergunte qual.'],
    }
  }
  if (offered) {
    draft.package.packageId = offered.id
    draft.package.packageKey = offered.packageKey
    draft.package.packageName = offered.label
    draft.package.confirmed = patch.confirmPackage === true
    if (!draft.package.confirmed) {
      draft.conversation.pendingAction = {
        type: 'confirm_package',
        packageId: offered.id,
        packageKey: offered.packageKey,
        packageName: offered.label,
      }
    } else if (draft.conversation.pendingAction?.type === 'confirm_package') {
      draft.conversation.pendingAction = null
    }
  }

  const optionGroupId = filled(patch.optionGroupId)
  const optionItemId = filled(patch.optionItemId)
  if (optionGroupId && optionItemId) {
    draft.package.packageSelections = {
      ...draft.package.packageSelections,
      [optionGroupId]: optionItemId,
    }
  }

  if (filled(patch.additionalBlockedReason)) {
    notes.push(patch.additionalBlockedReason!)
  } else if (filled(patch.additionalItemId) && typeof patch.additionalQty === 'number') {
    const itemId = patch.additionalItemId!.trim()
    const quantity = Math.max(0, Math.trunc(patch.additionalQty))
    draft.additionals = draft.additionals.filter((row) => row.itemId !== itemId)
    if (quantity > 0) {
      draft.additionals.push({
        itemId,
        itemKey: filled(patch.additionalItemKey),
        quantity,
      })
    }
  }

  if (patch.hasGrill === true || patch.hasGrill === false) {
    applyGrill(draft, patch.hasGrill)
  }

  if (patch.waiterAsked || typeof patch.waiterQty === 'number') {
    draft.service.waiterAsked = true
    if (typeof patch.waiterQty === 'number' && Number.isInteger(patch.waiterQty)) {
      draft.service.waiterQty = Math.max(0, patch.waiterQty)
    } else if (patch.waiterAsked && draft.service.waiterQty == null) {
      draft.conversation.pendingAction = { type: 'confirm_waiter_qty' }
    }
  }
  if (typeof patch.disposableKitQty === 'number' && Number.isInteger(patch.disposableKitQty)) {
    draft.service.disposableKitQty = Math.max(0, patch.disposableKitQty)
  }

  if (patch.confirmReview === true && refreshDraftStage(draft).conversation.readyForReview) {
    draft.conversation.pendingAction = { type: 'confirm_review' }
  }

  return { draft: refreshDraftStage(draft), rejected: null, notes }
}

export function resolvePendingIntakeAction(
  current: BrasinhaQuoteDraft,
  accepted: boolean,
): IntakeApplyResult {
  const draft = cloneQuoteDraft(current)
  const pending = draft.conversation.pendingAction
  if (!pending) {
    return { draft: refreshDraftStage(draft), rejected: 'no_pending_action', notes: [] }
  }
  if (!accepted) {
    draft.conversation.pendingAction = null
    if (pending.type === 'confirm_package') {
      draft.package.confirmed = false
    }
    if (pending.type === 'confirm_review') {
      draft.conversation.readyToCreateQuote = false
    }
    return { draft: refreshDraftStage(draft), rejected: null, notes: ['pending_declined'] }
  }
  if (pending.type === 'confirm_package') {
    draft.package.packageId = pending.packageId
    draft.package.packageKey = pending.packageKey
    draft.package.packageName = pending.packageName
    draft.package.confirmed = true
  }
  if (pending.type === 'confirm_children_bands') {
    draft.event.childrenUnder3Count = draft.event.childrenUnder3Count ?? 0
    draft.event.children4To12Count = draft.event.children4To12Count ?? 0
    draft.event.childrenBandsConfirmed = true
  }
  if (pending.type === 'confirm_waiter_qty' && draft.service.waiterQty == null) {
    draft.service.waiterAsked = true
    draft.service.waiterQty = 1
  }
  if (pending.type === 'confirm_review') {
    const ready = refreshDraftStage(draft)
    if (!ready.conversation.readyForReview) {
      return {
        draft: ready,
        rejected: 'review_incomplete',
        notes: ready.conversation.missingFields,
      }
    }
    draft.conversation.readyForReview = true
    draft.conversation.readyToCreateQuote = true
  }
  draft.conversation.pendingAction = null
  return { draft: refreshDraftStage(draft), rejected: null, notes: [] }
}

export async function resolvePackageFromCatalog(
  catalog: BrasinhaCatalogPort,
  companyId: string,
  language: Parameters<BrasinhaCatalogPort['getPackageDetails']>[2],
  query: string,
): Promise<PackageSummary | null> {
  const result = await catalog.getPackageDetails(companyId, query, language)
  return result.data
}
