import type {
  BrasinhaIntakeStage,
  BrasinhaQuoteDraft,
} from './draft.ts'

export type IntakeReadiness = {
  currentStage: BrasinhaIntakeStage
  missingFields: string[]
  readyForReview: boolean
}

export function refreshDraftStage(draft: BrasinhaQuoteDraft): BrasinhaQuoteDraft {
  const readiness = resolveIntakeReadiness(draft)
  draft.conversation.currentStage = readiness.currentStage
  draft.conversation.missingFields = readiness.missingFields
  draft.conversation.readyForReview = readiness.readyForReview
  if (!readiness.readyForReview) {
    draft.conversation.readyToCreateQuote = false
  }
  if (
    readiness.readyForReview &&
    !draft.conversation.readyToCreateQuote &&
    !draft.conversation.pendingAction
  ) {
    draft.conversation.pendingAction = { type: 'confirm_review' }
  }
  return draft
}

export function resolveIntakeReadiness(draft: BrasinhaQuoteDraft): IntakeReadiness {
  const missing: string[] = []
  if (!draft.contact.firstName) missing.push('contact.firstName')
  if (!draft.contact.lastName) missing.push('contact.lastName')
  if (!draft.contact.phone) missing.push('contact.phone')
  if (!draft.event.eventDate) missing.push('event.eventDate')
  if (!draft.event.startTime) missing.push('event.startTime')
  if (draft.event.adultCount == null || draft.event.adultCount <= 0) {
    missing.push('event.adultCount')
  }
  if (draft.event.childrenUnder3Count == null) missing.push('event.childrenUnder3Count')
  if (draft.event.children4To12Count == null) missing.push('event.children4To12Count')
  if (!draft.event.childrenBandsConfirmed) missing.push('event.childrenBandsConfirmed')
  if (!draft.event.formattedAddress && !draft.event.address && !draft.event.city) {
    missing.push('event.address')
  }
  if (!draft.package.packageId || !draft.package.confirmed) missing.push('package.confirmed')
  const pendingOptions = draft.package.requiredOptionGroupIds.filter(
    (groupId) => !draft.package.packageSelections[groupId]?.trim(),
  )
  if (draft.package.confirmed && pendingOptions.length) {
    missing.push('package.packageSelections')
  }
  if (!draft.grill.setupAnswered) missing.push('grill.setupAnswered')
  if (!draft.service.waiterAsked) missing.push('service.waiter')

  let currentStage: BrasinhaIntakeStage = 'REVIEW'
  if (!draft.contact.firstName) currentStage = 'CONTACT'
  else if (
    !draft.event.eventDate ||
    !draft.event.startTime ||
    draft.event.adultCount == null ||
    draft.event.childrenUnder3Count == null ||
    draft.event.children4To12Count == null ||
    !draft.event.childrenBandsConfirmed ||
    (!draft.event.formattedAddress && !draft.event.address && !draft.event.city)
  ) {
    currentStage = 'EVENT'
  } else if (!draft.package.packageId || !draft.package.confirmed) {
    currentStage = 'PACKAGE'
  } else if (missing.includes('package.packageSelections')) {
    currentStage = 'PACKAGE_OPTIONS'
  } else if (!draft.grill.setupAnswered || !draft.service.waiterAsked) {
    currentStage = 'BBQ_SERVICE'
  } else if (missing.length === 0) {
    currentStage = draft.conversation.readyToCreateQuote
      ? 'READY_TO_CREATE_QUOTE'
      : 'REVIEW'
  } else {
    currentStage = 'ADDITIONALS'
  }

  return {
    currentStage,
    missingFields: missing,
    readyForReview: missing.length === 0,
  }
}
