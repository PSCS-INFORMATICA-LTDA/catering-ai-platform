import { refreshDraftStage } from './stage.ts'

export const BRASINHA_INTAKE_STAGES = [
  'CONTACT',
  'EVENT',
  'PACKAGE',
  'PACKAGE_OPTIONS',
  'ADDITIONALS',
  'BBQ_SERVICE',
  'REVIEW',
  'READY_TO_CREATE_QUOTE',
] as const

export type BrasinhaIntakeStage = (typeof BRASINHA_INTAKE_STAGES)[number]

export type BrasinhaIntakePendingAction =
  | {
      type: 'confirm_package'
      packageId: string
      packageKey: string | null
      packageName: string
    }
  | {
      type: 'confirm_children_bands'
    }
  | {
      type: 'confirm_review'
    }
  | {
      type: 'confirm_waiter_qty'
    }
  | null

export type OfferedPackage = {
  id: string
  packageKey: string | null
  label: string
  pricePerPerson: number | null
}

export type BrasinhaQuoteDraft = {
  version: 1
  contact: {
    firstName: string | null
    lastName: string | null
    phone: string | null
    email: string | null
  }
  event: {
    eventDate: string | null
    startTime: string | null
    adultCount: number | null
    childrenUnder3Count: number | null
    children4To12Count: number | null
    childrenBandsConfirmed: boolean
    address: string | null
    formattedAddress: string | null
    city: string | null
    state: string | null
    zipCode: string | null
  }
  package: {
    packageId: string | null
    packageKey: string | null
    packageName: string | null
    packageSelections: Record<string, string>
    requiredOptionGroupIds: string[]
    confirmed: boolean
  }
  additionals: Array<{ itemId: string; itemKey: string | null; quantity: number }>
  grill: {
    setupAnswered: boolean
    hasGrill: boolean | null
    photoStatus: 'not_applicable' | 'pending' | 'received'
    photoReference: string | null
    rentalRequired: boolean
    rentalQty: 0 | 1
  }
  service: {
    waiterAsked: boolean
    waiterQty: number | null
    disposableKitQty: number | null
  }
  conversation: {
    currentStage: BrasinhaIntakeStage
    missingFields: string[]
    pendingAction: BrasinhaIntakePendingAction
    readyForReview: boolean
    readyToCreateQuote: boolean
    lastOfferedPackages: OfferedPackage[]
  }
}

export function createEmptyQuoteDraft(): BrasinhaQuoteDraft {
  return {
    version: 1,
    contact: {
      firstName: null,
      lastName: null,
      phone: null,
      email: null,
    },
    event: {
      eventDate: null,
      startTime: null,
      adultCount: null,
      childrenUnder3Count: null,
      children4To12Count: null,
      childrenBandsConfirmed: false,
      address: null,
      formattedAddress: null,
      city: null,
      state: null,
      zipCode: null,
    },
    package: {
      packageId: null,
      packageKey: null,
      packageName: null,
      packageSelections: {},
      requiredOptionGroupIds: [],
      confirmed: false,
    },
    additionals: [],
    grill: {
      setupAnswered: false,
      hasGrill: null,
      photoStatus: 'not_applicable',
      photoReference: null,
      rentalRequired: false,
      rentalQty: 0,
    },
    service: {
      waiterAsked: false,
      waiterQty: null,
      disposableKitQty: null,
    },
    conversation: {
      currentStage: 'CONTACT',
      missingFields: [],
      pendingAction: null,
      readyForReview: false,
      readyToCreateQuote: false,
      lastOfferedPackages: [],
    },
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(value)) {
    return Number(value)
  }
  return null
}

function asInt(value: unknown): number | null {
  const number = asNumber(value)
  if (number == null || !Number.isInteger(number)) return null
  return number
}

export function parseQuoteDraft(value: unknown): BrasinhaQuoteDraft {
  const empty = createEmptyQuoteDraft()
  const record = asRecord(value)
  if (!record || record.version !== 1) return empty
  const contact = asRecord(record.contact) ?? {}
  const event = asRecord(record.event) ?? {}
  const pkg = asRecord(record.package) ?? {}
  const grill = asRecord(record.grill) ?? {}
  const service = asRecord(record.service) ?? {}
  const conversation = asRecord(record.conversation) ?? {}
  const selections = asRecord(pkg.packageSelections) ?? {}
  const offered = Array.isArray(conversation.lastOfferedPackages)
    ? conversation.lastOfferedPackages
    : []
  const parsed: BrasinhaQuoteDraft = {
    version: 1,
    contact: {
      firstName: asString(contact.firstName),
      lastName: asString(contact.lastName),
      phone: asString(contact.phone),
      email: asString(contact.email),
    },
    event: {
      eventDate: asString(event.eventDate),
      startTime: asString(event.startTime),
      adultCount: asInt(event.adultCount),
      childrenUnder3Count: asInt(event.childrenUnder3Count),
      children4To12Count: asInt(event.children4To12Count),
      childrenBandsConfirmed: event.childrenBandsConfirmed === true,
      address: asString(event.address),
      formattedAddress: asString(event.formattedAddress),
      city: asString(event.city),
      state: asString(event.state),
      zipCode: asString(event.zipCode),
    },
    package: {
      packageId: asString(pkg.packageId),
      packageKey: asString(pkg.packageKey),
      packageName: asString(pkg.packageName),
      packageSelections: Object.fromEntries(
        Object.entries(selections).filter(
          (entry): entry is [string, string] =>
            typeof entry[0] === 'string' && typeof entry[1] === 'string' && Boolean(entry[1].trim()),
        ),
      ),
      requiredOptionGroupIds: Array.isArray(pkg.requiredOptionGroupIds)
        ? pkg.requiredOptionGroupIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
        : [],
      confirmed: pkg.confirmed === true,
    },
    additionals: Array.isArray(record.additionals)
      ? record.additionals.flatMap((row) => {
          const item = asRecord(row)
          const itemId = asString(item?.itemId)
          const quantity = asInt(item?.quantity)
          if (!itemId || quantity == null || quantity <= 0) return []
          return [{ itemId, itemKey: asString(item?.itemKey), quantity }]
        })
      : [],
    grill: {
      setupAnswered: grill.setupAnswered === true,
      hasGrill: grill.hasGrill === true ? true : grill.hasGrill === false ? false : null,
      photoStatus:
        grill.photoStatus === 'received' || grill.photoStatus === 'pending'
          ? grill.photoStatus
          : 'not_applicable',
      photoReference: asString(grill.photoReference),
      rentalRequired: grill.rentalRequired === true,
      rentalQty: grill.rentalQty === 1 ? 1 : 0,
    },
    service: {
      waiterAsked: service.waiterAsked === true,
      waiterQty: asInt(service.waiterQty),
      disposableKitQty: asInt(service.disposableKitQty),
    },
    conversation: {
      currentStage: empty.conversation.currentStage,
      missingFields: [],
      pendingAction: (conversation.pendingAction as BrasinhaIntakePendingAction) ?? null,
      readyForReview: conversation.readyForReview === true,
      readyToCreateQuote: conversation.readyToCreateQuote === true,
      lastOfferedPackages: offered.flatMap((row) => {
        const item = asRecord(row)
        const id = asString(item?.id)
        if (!id) return []
        return [
          {
            id,
            packageKey: asString(item?.packageKey),
            label: asString(item?.label) ?? id,
            pricePerPerson: asNumber(item?.pricePerPerson),
          },
        ]
      }),
    },
  }
  return refreshDraftStage(parsed)
}

export function cloneQuoteDraft(draft: BrasinhaQuoteDraft): BrasinhaQuoteDraft {
  return parseQuoteDraft(JSON.parse(JSON.stringify(draft)))
}

export function publicIntakeSnapshot(draft: BrasinhaQuoteDraft) {
  return {
    currentStage: draft.conversation.currentStage,
    missingFields: draft.conversation.missingFields,
    pendingActionType: draft.conversation.pendingAction?.type ?? null,
    readyForReview: draft.conversation.readyForReview,
    readyToCreateQuote: draft.conversation.readyToCreateQuote,
    packageKey: draft.package.packageKey,
    packageName: draft.package.packageName,
  }
}

export function snapshotQuoteDraft(draft: BrasinhaQuoteDraft): Record<string, unknown> {
  return {
    currentStage: draft.conversation.currentStage,
    missingFields: draft.conversation.missingFields,
    pendingAction: draft.conversation.pendingAction,
    readyForReview: draft.conversation.readyForReview,
    readyToCreateQuote: draft.conversation.readyToCreateQuote,
    contact: draft.contact,
    event: {
      eventDate: draft.event.eventDate,
      startTime: draft.event.startTime,
      adultCount: draft.event.adultCount,
      childrenUnder3Count: draft.event.childrenUnder3Count,
      children4To12Count: draft.event.children4To12Count,
      childrenBandsConfirmed: draft.event.childrenBandsConfirmed,
      city: draft.event.city,
      state: draft.event.state,
      zipCode: draft.event.zipCode,
      hasAddress: Boolean(draft.event.formattedAddress || draft.event.address),
    },
    package: draft.package,
    additionals: draft.additionals,
    grill: draft.grill,
    service: draft.service,
    lastOfferedPackages: draft.conversation.lastOfferedPackages,
  }
}
