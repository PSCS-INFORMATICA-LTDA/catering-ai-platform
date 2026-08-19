'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import AdminCompactMenu from '../../../components/quotes/AdminCompactMenu'
import { useTenant } from '../../../components/tenant/TenantProvider'
import CatalogImageFrame from '../../../components/CatalogImageFrame'
import QuoteStepHeader from '../../../components/quotes/QuoteStepHeader'
import QuoteStepper from '../../../components/quotes/QuoteStepper'
import QuotePackageStepExplorer from '../../../components/quotes/QuotePackageStepExplorer'
import PublicPackageCatalog from '../../../components/quotes/PublicPackageCatalog'
import PublicPhoneField from '../../../components/quotes/PublicPhoneField'
import QuoteWizardStepNav from '../../../components/quotes/QuoteWizardStepNav'
import AdditionalCategorySection from '../../../components/quotes/additionals/AdditionalCategorySection'
import { useAutoEventDistance } from '@/Lib/hooks/useAutoEventDistance'
import {
  calcAdditionalLineTotalForItem,
  getAdditionalUnitPrice,
  getLocalizedAdditionalLabel,
  groupAdditionalItemsByCategory,
  isPerPersonAdditional,
  normalizeAdditionalQuantity,
} from '../../../Lib/quoteAdditionalDisplay'
import { getAdditionalItemCategoryKey } from '@/Lib/additionalItemFieldAccess'
import {
  buildAdditionalCategoryDisplayLabels,
  getUnvisitedAdditionalCategoryKeys,
  getVisibleAdditionalCategoryKeys,
  pruneVisitedAdditionalCategories,
} from '@/Lib/wizardAdditionalCategories'
import {
  canAdvanceFromAdditionalsStep,
  resolveNextWizardStep,
  WIZARD_STEP_COUNT,
} from '@/Lib/wizardStepAdvance'
import { getQuoteStrings, tw } from '../../../Lib/quoteTranslations'
import { useAuthLocaleFromMe } from '../../../Lib/i18n/useAuthLocaleFromMe'
import {
  formatUiDate,
  toBcp47Locale,
} from '../../../Lib/i18n/locales'
import { tCommon } from '../../../Lib/i18n/common'
import PackageOptionsDebugPanel from '../../../components/quotes/PackageOptionsDebugPanel'
import { CDL_DEFAULT_COMPANY_ID } from '../../../Lib/cdlCompany'
import type { PackageOptionQueryDebug } from '../../../Lib/fetchPackageOptionGroups'
import {
  sortPackagesByCommercialTier,
} from '../../../Lib/packageDisplay'
import {
  getPackageDescription as catalogPackageDescription,
  getPackageLabel,
} from '../../../Lib/packageFieldAccess'
import QuoteWizardConfirmationStep from '../../../components/quote-review/QuoteWizardConfirmationStep'
import PublicQuoteConfirmationStep from '../../../components/quote-review/PublicQuoteConfirmationStep'
import {
  getPublicPackageSidesGroup,
  resolvePackageCatalogImageUrl,
} from '../../../Lib/packageCatalogVisual'
import { calcAdditionalLineTotal } from '../../../Lib/calculateQuoteTotals'
import type { CommercialRulesSnapshot } from '../../../Lib/supabaseCommercialRules'
import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'
import { useQuotePricingPreview } from '@/Lib/hooks/useQuotePricingPreview'
import type { QuoteSaveInput } from '../../../Lib/buildQuoteSavePayload'
import { saveQuoteViaApi } from '../../../Lib/saveQuoteViaApi'
import {
  buildSaveQuoteError,
  logSaveQuoteError,
  normalizeSaveQuoteError,
  type SaveQuoteErrorInfo,
} from '../../../Lib/supabaseSaveError'
import {
  CUSTOMER_DISPLAY_NAME_EMPTY,
  getCustomerDisplayName,
} from '../../../Lib/getCustomerDisplayName'
import { getCatalogItemImageUrl } from '../../../Lib/catalogItemVisual'
import { filterCatalogItems } from '../../../Lib/itemCatalog'
import { isUsablePostalCode } from '../../../Lib/cep'
import { isUsablePhone, normalizePhone } from '../../../Lib/normalizePhone'
import {
  deriveEventEndTime,
  resolveServiceDurationMinutes,
} from '@/Lib/publicQuote/eventDuration'
import {
  findPackageByIdOrKey,
  resolvePackageIdForPersistence,
} from '@/Lib/publicQuote/packageLookup'
import {
  isUsablePublicPhone,
  sanitizeStoredPublicPhone,
  toPublicPhoneE164,
} from '@/Lib/publicQuote/phone'
import type { PublicLocationBias } from '@/Lib/publicQuote/locationBias'
import {
  dedupeCustomersList,
  filterCustomersBySearch,
  mergeCustomerIntoList,
  sortCustomersByRecency,
} from '../../../Lib/searchCustomers'
import {
  grillPhotoStatusToRequired,
  type GrillPhotoStatus,
} from '../../../Lib/grillPhotoStatus'
import type { QuoteSnapshotRecord } from '../../../Lib/readQuoteSnapshot'
import type {
  PackageItem,
  PackageSideItem,
} from '../../../Lib/packageConfiguration'
import {
  flattenPackageOptionGroupItems,
  getBlockedCatalogItemIds,
  getPendingPackageSelectionGroupIds,
  getPackageOptionGroupsForPackage,
  mergeOptionGroupsForPackage,
  isCustomPackage,
  prunePackageSelectionsForPackage,
  validatePackageSelections,
  type PackageOptionGroup,
  type PackageOptionGroupItem,
  type PackageOptionGroupRecord,
} from '../../../Lib/packageOptionGroups'
import {
  buildPricingFingerprint,
  createInitialWizardState,
  type QuoteLanguage,
  type WizardState,
} from '../../../Lib/quoteWizardTypes'
import AddressAutocompleteFields from './AddressAutocompleteFields'
import {
  canNavigateToStep,
  getMandatoryPendingSteps,
  getMaxReachableStep,
  getStepIssues,
  getStepVisualStatus,
  isGrillPhotoRequiredAndMissing,
  isQuoteReadyToSave,
  type StepStatusContext,
} from './wizardStepStatus'

export type Customer = {
  id: string
  ab_name?: string | null
  ab_number?: string | null
  full_name?: string | null
  contact_name?: string | null
  company_name?: string | null
  email?: string | null
  phone?: string | null
  phone_normalized?: string | null
  address_line?: string | null
  address?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  postal_code?: string | null
  venue_name?: string | null
  is_supplier?: boolean | null
  updated_at?: string | null
  created_at?: string | null
}

export type Package = {
  id: string
  package_key?: string | null
  package_name?: string | null
  label_pt?: string | null
  label_en?: string | null
  label_es?: string | null
  description_pt?: string | null
  description_en?: string | null
  description_es?: string | null
  description?: string | null
  price_per_person?: number | null
  price?: number | null
  base_price?: number | null
  currency_code?: string | null
  display_order?: number | null
  active?: boolean | null
  image_url?: string | null
  item_type?: string | null
  category_pt?: string | null
  card_theme_key?: string | null
}

export type PublicQuoteWizardContext = {
  companyId: string
  companySlug: string
  branchId?: string | null
  allowedCountries: string[]
  consentVersion: string
  consentLabel: string
  privacyUrl?: string | null
  supportWhatsappUrl?: string | null
  currencyCode?: string
  serviceDurationMinutes?: number
  locationBias?: PublicLocationBias | null
}

export type PublicQuoteSubmissionResult = {
  quote: {
    id: string
    number?: string | null
    eventName: string
    eventDate: string
    total?: number | null
    currency?: string | null
  }
  alreadySubmitted?: boolean
}

export type AdditionalItem = {
  id: string
  item_key?: string | null
  item_name?: string | null
  label_pt?: string | null
  label_en?: string | null
  label_es?: string | null
  category_pt?: string | null
  price?: number | null
  sale_price?: number | null
  current_price?: number | null
  pricing_type?: string | null
  charge_type?: string | null
  quantity?: number | null
  unit?: string | null
  quantity_2?: number | null
  uom_2?: string | null
  unit_label?: string | null
  display_order?: number | null
  image_url?: string | null
  image_status?: string | null
  item_type?: string | null
  operational_item?: boolean | null
  can_be_additional?: boolean | null
  can_be_package_item?: boolean | null
  can_be_side_item?: boolean | null
  can_be_option_choice?: boolean | null
  active?: boolean | null
  customer_visible?: boolean | null
}

/** Item do catálogo mestre (`catalog_items`). */
export type CatalogItem = AdditionalItem

function buildPublicIntakeDraft(
  state: WizardState,
  persistedPackageId?: string | null,
  reviewedCategoryKeys: string[] = [],
) {
  return {
    locale: state.language,
    contact: {
      firstName: state.customerFirstName.trim(),
      lastName: state.customerLastName.trim(),
      phone:
        toPublicPhoneE164(state.customerDraftPhone) ||
        state.customerDraftPhone.trim(),
      email: state.customerDraftEmail.trim() || null,
    },
    event: {
      eventName:
        state.eventName.trim() ||
        [state.customerFirstName, state.customerLastName]
          .map((value) => value.trim())
          .filter(Boolean)
          .join(' '),
      eventDate: state.eventDate,
      startTime: state.startTime,
      endTime: state.endTime,
      adultCount: state.adultCount,
      childrenUnder3Count: state.childrenUnder3Count,
      children4To12Count: state.children4To12Count,
      address: {
        route: state.address,
        number: state.addressNumber,
        city: state.city,
        region: state.state,
        postalCode: state.zipCode,
        country: state.addressCountry,
        formattedAddress: state.addressFormatted,
        placeId: state.addressPlaceId,
        latitude: state.addressLatitude,
        longitude: state.addressLongitude,
        source: state.addressSource,
      },
    },
    selection: {
      packageId: persistedPackageId || state.packageId,
      packageSelections: state.packageSelections,
      additionals: Object.entries(state.additionals)
        .filter(([, quantity]) => quantity > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity })),
      reviewedCategoryKeys,
    },
    grill: {
      setupAnswered: state.grillSetupAnswered,
      hasGrill: state.hasGrill,
      photoReference: state.grillPhotoReference,
      rentalRequired: state.grillRentalRequired,
      rentalQty: state.grillRentalQty,
      notes: state.grillNotes.trim() || null,
    },
  }
}


function formatDate(value: string, locale: string | null | undefined = 'pt') {
  return formatUiDate(value, locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function getCalendarWeekdays(locale: string | null | undefined) {
  const bcp = toBcp47Locale(locale)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2024, 0, 1 + i))
    return new Intl.DateTimeFormat(bcp, { weekday: 'short' }).format(date)
  })
}

function formatTime(value: string) {
  if (!value) return '—'
  const [hours, minutes] = value.split(':')
  if (!hours || minutes === undefined) return value
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

function formatTimeRange(start: string, end: string) {
  if (!start && !end) return '—'
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`
  return formatTime(start || end)
}

function parseDateValue(value: string) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


type FieldCompletion = 'filled' | 'empty'

function getFieldCompletion(value: string | number): FieldCompletion {
  if (typeof value === 'number') return value > 0 ? 'filled' : 'empty'
  return value.trim().length > 0 ? 'filled' : 'empty'
}

function fieldCompletionClass(completion?: FieldCompletion) {
  if (completion === 'filled') return 'cdl-field-filled'
  if (completion === 'empty') return 'cdl-field-empty'
  return 'border-cdl-border bg-cdl-inset'
}

function FieldCheck({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-cdl-success"
      aria-hidden
    >
      ✓
    </span>
  )
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour)
const MINUTE_OPTIONS = [0, 15, 30, 45]

function parseTimeParts(value: string) {
  if (!value) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return { hours, minutes }
}

function toTimeValue(hours: number, minutes: number) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function CalendarIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-cdl-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function DatePickerField({
  label,
  value,
  onChange,
  className = '',
  completion,
  language = 'pt',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  completion?: FieldCompletion
  language?: QuoteLanguage | string | null
}) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => parseDateValue(value) ?? new Date())
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedDate = parseDateValue(value)

  useEffect(() => {
    const parsed = parseDateValue(value)
    if (parsed) setViewDate(parsed)
  }, [value])

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: Array<number | null> = []

    for (let i = 0; i < firstWeekday; i += 1) cells.push(null)
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)

    return { year, month, cells }
  }, [viewDate])

  function selectDay(day: number) {
    onChange(toDateValue(new Date(calendarDays.year, calendarDays.month, day)))
    setOpen(false)
  }

  function shiftMonth(offset: number) {
    setViewDate(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    )
  }

  const monthLabel = viewDate.toLocaleDateString(toBcp47Locale(language), {
    month: 'long',
    year: 'numeric',
  })
  const weekdays = getCalendarWeekdays(language)

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-2 ${className}`}>
      <span className="cdl-eyebrow">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 pr-10 text-left text-base outline-none transition-colors hover:border-cdl-accent-border focus:border-cdl-accent-border ${fieldCompletionClass(completion)}`}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span className={selectedDate ? 'text-cdl-fg' : 'text-cdl-faint'}>
            {selectedDate ? formatDate(value, language) : tw(language, 'selectDate')}
          </span>
          <CalendarIcon />
        </button>
        <FieldCheck show={completion === 'filled'} />
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={tw(language, 'calendarOf', { label })}
          className="absolute left-0 top-full z-30 mt-2 w-full min-w-[300px] rounded-2xl border border-cdl-border bg-cdl-surface p-4 shadow-cdl-popup sm:w-[320px]"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-cdl-border bg-cdl-inset text-cdl-fg transition-colors hover:border-cdl-accent-border"
              aria-label={tw(language, 'prevMonth')}
            >
              ‹
            </button>
            <p className="text-sm font-bold capitalize text-cdl-accent">
              {monthLabel}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-cdl-border bg-cdl-inset text-cdl-fg transition-colors hover:border-cdl-accent-border"
              aria-label={tw(language, 'nextMonth')}
            >
              ›
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {weekdays.map((weekday) => (
              <span
                key={weekday}
                className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-cdl-muted"
              >
                {weekday}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.cells.map((day, index) => {
              if (day === null) {
                return <span key={`empty-${index}`} className="h-10" />
              }

              const isSelected =
                selectedDate?.getFullYear() === calendarDays.year &&
                selectedDate?.getMonth() === calendarDays.month &&
                selectedDate?.getDate() === day

              const isToday =
                new Date().getFullYear() === calendarDays.year &&
                new Date().getMonth() === calendarDays.month &&
                new Date().getDate() === day

              return (
                <button
                  key={`${calendarDays.year}-${calendarDays.month}-${day}`}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                    isSelected
                      ? 'bg-cdl-accent text-cdl-on-accent'
                      : isToday
                        ? 'border border-cdl-accent-border bg-cdl-accent-soft text-cdl-accent'
                        : 'text-cdl-fg hover:bg-cdl-muted-bg hover:text-cdl-accent'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ClockIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-cdl-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function TimePickerField({
  label,
  value,
  onChange,
  className = '',
  completion,
  language = 'pt',
  readOnly = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  completion?: FieldCompletion
  language?: QuoteLanguage | string | null
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = parseTimeParts(value)
  const [draftHour, setDraftHour] = useState(selected?.hours ?? 18)
  const [draftMinute, setDraftMinute] = useState(selected?.minutes ?? 0)

  useEffect(() => {
    const parsed = parseTimeParts(value)
    if (parsed) {
      setDraftHour(parsed.hours)
      setDraftMinute(parsed.minutes)
    }
  }, [value])

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function selectHour(hour: number) {
    setDraftHour(hour)
    onChange(toTimeValue(hour, draftMinute))
  }

  function selectMinute(minute: number) {
    setDraftMinute(minute)
    onChange(toTimeValue(draftHour, minute))
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-2 ${className}`}>
      <span className="cdl-eyebrow">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (readOnly) return
            setOpen((current) => !current)
          }}
          disabled={readOnly}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 pr-10 text-left text-base outline-none transition-colors ${
            readOnly
              ? 'cursor-not-allowed bg-cdl-inset text-cdl-muted'
              : 'hover:border-cdl-accent-border focus:border-cdl-accent-border'
          } ${fieldCompletionClass(completion)}`}
          aria-expanded={readOnly ? undefined : open}
          aria-haspopup={readOnly ? undefined : 'dialog'}
          aria-readonly={readOnly || undefined}
        >
          <span className={selected ? 'text-cdl-fg' : 'text-cdl-faint'}>
            {selected ? formatTime(value) : tw(language, 'selectTime')}
          </span>
          <ClockIcon />
        </button>
        <FieldCheck show={completion === 'filled'} />
      </div>

      {open && !readOnly && (
        <div
          role="dialog"
          aria-label={tw(language, 'timePickerOf', { label })}
          className="absolute left-0 top-full z-30 mt-2 w-full min-w-[300px] rounded-2xl border border-cdl-border bg-cdl-surface p-4 shadow-cdl-popup sm:w-[320px]"
        >
          <p className="mb-3 text-center text-sm font-bold text-cdl-accent">
            {toTimeValue(draftHour, draftMinute)}
          </p>

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-cdl-muted">
            {tw(language, 'hour')}
          </p>
          <div className="mb-4 grid max-h-40 grid-cols-6 gap-1 overflow-y-auto pr-1">
            {HOUR_OPTIONS.map((hour) => {
              const isSelected = draftHour === hour
              return (
                <button
                  key={hour}
                  type="button"
                  onClick={() => selectHour(hour)}
                  className={`flex h-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                    isSelected
                      ? 'bg-cdl-accent text-cdl-on-accent'
                      : 'text-cdl-fg hover:bg-cdl-muted-bg hover:text-cdl-accent'
                  }`}
                >
                  {String(hour).padStart(2, '0')}
                </button>
              )
            })}
          </div>

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-cdl-muted">
            {tw(language, 'minutes')}
          </p>
          <div className="grid grid-cols-4 gap-1">
            {MINUTE_OPTIONS.map((minute) => {
              const isSelected = draftMinute === minute
              return (
                <button
                  key={minute}
                  type="button"
                  onClick={() => selectMinute(minute)}
                  className={`flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                    isSelected
                      ? 'bg-cdl-accent text-cdl-on-accent'
                      : 'text-cdl-fg hover:bg-cdl-muted-bg hover:text-cdl-accent'
                  }`}
                >
                  {String(minute).padStart(2, '0')}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function getCustomerName(customer: Customer) {
  return getCustomerDisplayName(customer, { emptyLabel: '—' })
}

function getEventDefaultsFromCustomer(customer: Customer) {
  const customerName = getCustomerName(customer)

  return {
    eventName: customerName === '—' ? '' : customerName,
    address:
      customer.address_line ?? customer.address ?? customer.street ?? '',
    city: customer.city ?? '',
    state: customer.state ?? '',
    zipCode: customer.zip_code ?? customer.postal_code ?? '',
  }
}

function getPackageName(pkg: Package, language?: string | null) {
  return getPackageLabel(pkg, language)
}

function getPackageDescription(pkg: Package, language?: string | null) {
  return catalogPackageDescription(pkg, language)
}

function getPackagePrice(pkg: Package) {
  return Number(
    pkg.price_per_person ?? pkg.price ?? pkg.base_price ?? 0,
  )
}

function mapSelectedAdditionalRow(
  item: AdditionalItem,
  quantity: number,
  billableGuestCount: number,
  language: QuoteLanguage,
) {
  const normalizedQty = normalizeAdditionalQuantity(item, quantity)
  return {
    item,
    quantity: normalizedQty,
    unitPrice: getAdditionalUnitPrice(item),
    perPerson: isPerPersonAdditional(item),
    totalPrice: calcAdditionalLineTotalForItem(item, normalizedQty, billableGuestCount),
    categoryLabel: getLocalizedAdditionalLabel(item, language),
  }
}

// mileage + quote totals: see Lib/calculateQuoteTotals.ts

function SectionCard({
  title,
  children,
  className = '',
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-cdl-border bg-cdl-surface p-7 shadow-cdl sm:p-9 ${className}`}
    >
      {title ? <h2 className="cdl-section-title">{title}</h2> : null}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function InputField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
  step,
  min,
  max,
  completion,
  inputRef,
  onFocus,
  autoComplete,
}: {
  label: string
  type?: string
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  step?: string | number
  min?: string | number
  max?: string | number
  completion?: FieldCompletion
  inputRef?: React.RefObject<HTMLInputElement | null>
  onFocus?: () => void
  autoComplete?: string
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="cdl-eyebrow">{label}</span>
      <div className="relative">
        <input
          ref={inputRef}
          type={type}
          value={value}
          placeholder={placeholder}
          step={step}
          min={min}
          max={max}
          onFocus={onFocus}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-xl border px-4 py-3.5 pr-10 text-base text-cdl-fg shadow-cdl outline-none transition-colors placeholder:text-cdl-faint focus:border-cdl-accent-border ${fieldCompletionClass(completion)}`}
        />
        <FieldCheck show={completion === 'filled'} />
      </div>
    </label>
  )
}

function QuantityField({
  label,
  value,
  onChange,
  className = '',
  placeholder = '0',
  min = 0,
  disabled = false,
  completion,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  className?: string
  placeholder?: string
  min?: number
  disabled?: boolean
  completion?: FieldCompletion
}) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="cdl-eyebrow">{label}</span>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            const next =
              draft === ''
                ? min
                : Math.max(min, Number.parseInt(draft, 10) || min)
            onChange(next)
            setDraft(String(next))
          }}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '')
            setDraft(raw)
            if (raw !== '') {
              onChange(Math.max(min, Number.parseInt(raw, 10) || min))
            }
          }}
          className={`w-full rounded-xl border px-4 py-3.5 pr-10 text-base text-cdl-fg shadow-cdl outline-none transition-colors placeholder:text-cdl-faint focus:border-cdl-accent-border disabled:cursor-not-allowed disabled:opacity-40 ${fieldCompletionClass(completion)}`}
        />
        <FieldCheck show={completion === 'filled'} />
      </div>
    </label>
  )
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-cdl-border bg-cdl-inset px-5 py-4 shadow-cdl transition-colors hover:border-cdl-accent-border">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-cdl-brand"
      />
      <span className="text-xs font-bold uppercase tracking-wider text-cdl-fg">
        {label}
      </span>
    </label>
  )
}

function GrillPhotoStatusField({
  value,
  disabled,
  onChange,
  language = 'pt',
}: {
  value: GrillPhotoStatus
  disabled?: boolean
  onChange: (value: GrillPhotoStatus) => void
  language?: QuoteLanguage | string | null
}) {
  const options: { value: GrillPhotoStatus; label: string }[] = [
    { value: 'received', label: tw(language, 'yes') },
    { value: 'pending', label: tw(language, 'no') },
    { value: 'not_applicable', label: tw(language, 'notApplicable') },
  ]

  return (
    <fieldset className="sm:col-span-2">
      <legend className="cdl-eyebrow">{tw(language, 'grillPhotoReceived')}</legend>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <label
              key={option.value}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                selected
                  ? 'border-cdl-accent-border bg-cdl-accent/10 text-cdl-brand'
                  : 'border-cdl-border bg-cdl-inset text-cdl-text-secondary hover:border-cdl-accent-border'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input
                type="radio"
                name="grill-photo-status"
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="accent-[var(--cdl-action)]"
              />
              {option.label}
            </label>
          )
        })}
      </div>
      {value === 'received' ? (
        <p className="mt-2 text-xs text-cdl-success">
          {tw(language, 'photoConfirmed')}
        </p>
      ) : null}
      {value === 'pending' ? (
        <p className="mt-2 text-xs text-cdl-warning">
          {tw(language, 'photoPendingHint')}
        </p>
      ) : null}
    </fieldset>
  )
}

export { getStepVisualStatus } from './wizardStepStatus'

export default function QuoteWizardCore({
  customers,
  packages,
  catalogItems,
  additionalItems,
  packageOptionGroups = [],
  packageOptionGroupItems = [],
  packageOptionQueryDebug = null,
  packageItems = [],
  packageSideItems = [],
  commercialRules,
  fetchErrors,
  mode = 'create',
  quoteId,
  initialState,
  initialPricingFingerprint,
  existingSnapshot,
  linkedCustomer = null,
  initialStep = 0,
  initialUiLocale,
  entryMode = 'authenticated',
  publicContext,
  onPublicSuccess,
  initialReviewedCategoryKeys,
}: {
  customers: Customer[]
  packages: Package[]
  catalogItems?: CatalogItem[]
  /** @deprecated Use catalogItems */
  additionalItems?: AdditionalItem[]
  packageOptionGroups?: PackageOptionGroupRecord[]
  packageOptionGroupItems?: PackageOptionGroupItem[]
  packageOptionQueryDebug?: PackageOptionQueryDebug | null
  packageItems?: PackageItem[]
  packageSideItems?: PackageSideItem[]
  commercialRules: CommercialRulesSnapshot
  fetchErrors: string[]
  mode?: 'create' | 'edit'
  quoteId?: string
  initialState?: WizardState
  initialPricingFingerprint?: string
  existingSnapshot?: QuoteSnapshotRecord
  linkedCustomer?: Customer | null
  initialStep?: number
  initialUiLocale?: string | null
  entryMode?: 'authenticated' | 'public'
  publicContext?: PublicQuoteWizardContext
  onPublicSuccess?: (result: PublicQuoteSubmissionResult) => void
  initialReviewedCategoryKeys?: string[]
}) {
  const itemCatalog = catalogItems ?? additionalItems ?? []
  const isEditMode = mode === 'edit' && Boolean(quoteId)
  const isPublicMode = entryMode === 'public'
  const { branchId: tenantBranchId, companyId: tenantCompanyId } = useTenant()
  const [step, setStep] = useState(() =>
    Math.min(Math.max(initialStep, 0), WIZARD_STEP_COUNT - 1),
  )
  const [state, setState] = useState<WizardState>(() => {
    const base = initialState ?? createInitialWizardState(commercialRules)
    if (!isPublicMode) return base
    const language: QuoteLanguage =
      initialUiLocale === 'en' || initialUiLocale === 'es' ? initialUiLocale : 'pt'
    return {
      ...base,
      language,
      branchId: publicContext?.branchId ?? base.branchId,
      publicConsentVersion:
        publicContext?.consentVersion ?? base.publicConsentVersion,
      customerDraftPhone: sanitizeStoredPublicPhone(base.customerDraftPhone),
    }
  })
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const customerSearchRef = useRef<HTMLDivElement>(null)
  const [endTimeCustomized, setEndTimeCustomized] = useState(false)
  const [openAdditionalCategories, setOpenAdditionalCategories] = useState<
    Set<string>
  >(() => new Set())
  const [visitedAdditionalCategories, setVisitedAdditionalCategories] =
    useState<Set<string>>(
      () => new Set(initialReviewedCategoryKeys?.filter(Boolean) ?? []),
    )
  const visitedAdditionalCategoriesRef = useRef(visitedAdditionalCategories)
  const additionalCategoryKeysRef = useRef<string[]>([])
  const extrasExposeArmedRef = useRef(true)
  visitedAdditionalCategoriesRef.current = visitedAdditionalCategories
  const grillPhotoInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveErrorInfo, setSaveErrorInfo] = useState<SaveQuoteErrorInfo | null>(
    null,
  )
  const [localCustomers, setLocalCustomers] = useState(() =>
    dedupeCustomersList(sortCustomersByRecency(customers)),
  )
  const [customersRefreshing, setCustomersRefreshing] = useState(false)
  const [customerLinkSuccess, setCustomerLinkSuccess] = useState<string | null>(
    null,
  )
  const [packageStepMessage, setPackageStepMessage] = useState<string | null>(
    null,
  )
  const [navigationIssues, setNavigationIssues] = useState<string[]>([])
  const [publicUploadError, setPublicUploadError] = useState<string | null>(null)
  const [publicUploading, setPublicUploading] = useState(false)
  const [publicAutosaveStatus, setPublicAutosaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [emphasizedAdditionalCategory, setEmphasizedAdditionalCategory] =
    useState<string | null>(null)
  const [additionalsReviewPrompt, setAdditionalsReviewPrompt] = useState(false)
  const publicIdempotencyKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!tenantBranchId || state.branchId) return
    setState((prev) => ({ ...prev, branchId: tenantBranchId }))
  }, [tenantBranchId, state.branchId])
  const [packageSelectionAttempted, setPackageSelectionAttempted] =
    useState(false)
  const [flatOptionGroups, setFlatOptionGroups] = useState<
    PackageOptionGroupRecord[]
  >(() => packageOptionGroups)
  const [flatOptionGroupItems, setFlatOptionGroupItems] = useState<
    PackageOptionGroupItem[]
  >(() => packageOptionGroupItems)
  const [packageOptionQueryDebugState, setPackageOptionQueryDebugState] =
    useState<PackageOptionQueryDebug | null>(() => packageOptionQueryDebug)
  const uiLocale = useAuthLocaleFromMe(initialUiLocale, {
    disabled: isPublicMode,
  })
  const quoteStrings = useMemo(
    () => getQuoteStrings(uiLocale),
    [uiLocale],
  )
  const wizardSteps = quoteStrings.wizardSteps
  const w = quoteStrings.wizard

  const debugCompanyId =
    publicContext?.companyId?.trim() ||
    tenantCompanyId?.trim() ||
    CDL_DEFAULT_COMPANY_ID
  const debugBranchId =
    state.branchId?.trim() ||
    publicContext?.branchId?.trim() ||
    tenantBranchId?.trim() ||
    null
  const queryPackageIds = useMemo(
    () => packages.map((pkg) => pkg.id).filter(Boolean),
    [packages],
  )
  const router = useRouter()
  const distanceInputRef = useRef<HTMLInputElement>(null)
  const distanceManualRef = useRef(false)
  const previousStepRef = useRef(step)

  useEffect(() => {
    distanceManualRef.current = false
    // A new destination invalidates the previous route: never show the mileage
    // of an address the customer already replaced.
    if (!isPublicMode) return
    setState((prev) => (prev.distance === 0 ? prev : { ...prev, distance: 0 }))
  }, [
    isPublicMode,
    state.address,
    state.addressNumber,
    state.city,
    state.state,
    state.zipCode,
  ])

  useAutoEventDistance({
    origin: state.baseLocation,
    address: state.address,
    addressNumber: state.addressNumber,
    city: state.city,
    state: state.state,
    zipCode: state.zipCode,
    enabled: !distanceManualRef.current,
    onDistance: (miles) => {
      setState((prev) =>
        prev.distance === miles ? prev : { ...prev, distance: miles },
      )
    },
  })

  useEffect(() => {
    setFlatOptionGroups(packageOptionGroups)
    setFlatOptionGroupItems(packageOptionGroupItems)
    setPackageOptionQueryDebugState(packageOptionQueryDebug)
  }, [packageOptionGroups, packageOptionGroupItems, packageOptionQueryDebug])

  const packageOptionQueryDebugForPanel = useMemo((): PackageOptionQueryDebug => {
    const base = packageOptionQueryDebugState
    const packageIds = base?.packageIds?.length
      ? base.packageIds
      : state.packageId?.trim()
        ? [state.packageId.trim()]
        : queryPackageIds
    return {
      queryCompanyId: base?.queryCompanyId ?? debugCompanyId,
      packageIds,
      packageIdsCount: packageIds.length,
      currentBranchId: debugBranchId,
      branchFilterActive: base?.branchFilterActive ?? false,
      groupsFetched: base?.groupsFetched ?? flatOptionGroups.length,
      itemsFetched: base?.itemsFetched ?? flatOptionGroupItems.length,
      groupsQueryRan: base?.groupsQueryRan ?? false,
      itemsQueryRan: base?.itemsQueryRan ?? false,
      groupsError: base?.groupsError ?? null,
      itemsError: base?.itemsError ?? null,
    }
  }, [
    packageOptionQueryDebugState,
    debugCompanyId,
    queryPackageIds,
    debugBranchId,
    state.packageId,
    flatOptionGroups.length,
    flatOptionGroupItems.length,
  ])

  useEffect(() => {
    if (isPublicMode) return
    const packageId = state.packageId?.trim()
    if (!packageId) return

    let cancelled = false

    const params = new URLSearchParams({ package_id: packageId })
    if (debugBranchId) {
      params.set('branch_id', debugBranchId)
    }

    fetch(`/api/package-option-choices?${params.toString()}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          groups?: PackageOptionGroupRecord[]
          groupItems?: PackageOptionGroupItem[]
          queryDebug?: PackageOptionQueryDebug
          error?: string
        }
        if (!res.ok) {
          console.warn(
            '[package-option-choices] fetch falhou:',
            res.status,
            json.error,
            json.queryDebug?.groupsError,
            json.queryDebug?.itemsError,
          )
        }
        return json
      })
      .then((json) => {
        if (cancelled || !json) return

        if (json.queryDebug) {
          setPackageOptionQueryDebugState(json.queryDebug)
        }

        if (!json.groups) return

        if (json.groups.length === 0) {
          console.warn(
            '[package-option-choices] 0 grupos para package_id',
            packageId,
            '— mantendo cache SSR',
            json.queryDebug,
          )
          return
        }

        setFlatOptionGroups((prev) => {
          const rest = prev.filter(
            (group) => group.package_id?.trim() !== packageId,
          )
          return [...rest, ...json.groups!]
        })
        setFlatOptionGroupItems((prev) => {
          const groupIds = new Set(json.groups!.map((group) => group.id))
          const rest = prev.filter(
            (item) => !groupIds.has(item.option_group_id?.trim() ?? ''),
          )
          return [...rest, ...(json.groupItems ?? [])]
        })
      })
      .catch((fetchError) => {
        console.warn('[package-option-choices] fetch erro:', fetchError)
      })

    return () => {
      cancelled = true
    }
  }, [state.packageId, debugBranchId, isPublicMode])

  useEffect(() => {
    setLocalCustomers((current) => {
      const merged = sortCustomersByRecency([...customers])
      for (const row of current) {
        if (!merged.some((customer) => customer.id === row.id)) {
          merged.unshift(row)
        }
      }
      return dedupeCustomersList(sortCustomersByRecency(merged))
    })
  }, [customers])

  const refreshCustomersFromApi = async (query = customerSearch) => {
    setCustomersRefreshing(true)
    try {
      const params = new URLSearchParams({ _: String(Date.now()) })
      if (query.trim()) params.set('q', query.trim())
      const response = await fetch(`/api/customers?${params.toString()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      const result = (await response.json()) as {
        data?: Customer[]
        error?: string
      }
      if (!response.ok || !result.data) {
        throw new Error(result.error ?? w.refreshCustomersError)
      }
      setLocalCustomers((current) => {
        const merged = sortCustomersByRecency(result.data ?? [])
        for (const row of current) {
          if (!merged.some((customer) => customer.id === row.id)) {
            merged.unshift(row)
          }
        }
        return dedupeCustomersList(sortCustomersByRecency(merged))
      })
    } catch (refreshError) {
      updateState({
        customerPhoneLinkError:
          refreshError instanceof Error
            ? refreshError.message
            : w.refreshCustomersListError,
      })
    } finally {
      setCustomersRefreshing(false)
    }
  }

  const selectedCustomer = isEditMode
    ? linkedCustomer ??
      (state.customerId ? { id: state.customerId } as Customer : null)
    : localCustomers.find((c) => c.id === state.customerId) ?? null

  const editCustomerDisplayName = linkedCustomer
    ? getCustomerDisplayName(linkedCustomer)
    : state.customerId
      ? w.linkedCustomerNotFound
      : CUSTOMER_DISPLAY_NAME_EMPTY
  const selectedPackageRef = useRef<Package | null>(null)
  const selectedPackage =
    findPackageByIdOrKey(packages, state.packageId) ??
    selectedPackageRef.current
  useEffect(() => {
    const found = findPackageByIdOrKey(packages, state.packageId)
    if (found) selectedPackageRef.current = found
  }, [packages, state.packageId])

  const serviceDurationMinutes = resolveServiceDurationMinutes(
    publicContext?.serviceDurationMinutes,
  )

  const packageImageUrl = useMemo(
    () =>
      resolvePackageCatalogImageUrl(
        selectedPackage,
        packages,
        state.packageId,
      ),
    [selectedPackage, packages, state.packageId],
  )

  const filteredCustomers = useMemo(() => {
    const quoteClients = localCustomers.filter(
      (row) => row.is_supplier !== true,
    )
    return filterCustomersBySearch(quoteClients, customerSearch)
  }, [localCustomers, customerSearch])

  const customerSuggestions = useMemo(() => {
    if (customerSearch.trim().length < 1) return []
    return filteredCustomers.slice(0, 12)
  }, [filteredCustomers, customerSearch])

  useEffect(() => {
    if (!customerSearchOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const root = customerSearchRef.current
      if (!root) return
      if (event.target instanceof Node && !root.contains(event.target)) {
        setCustomerSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [customerSearchOpen])

  const packagesWithoutSides = useMemo(
    () =>
      sortPackagesByCommercialTier(
        packages.filter(
          (p) => getPublicPackageSidesGroup(p) === 'without_sides',
        ),
      ),
    [packages],
  )

  const packagesWithSides = useMemo(
    () =>
      sortPackagesByCommercialTier(
        packages.filter((p) => getPublicPackageSidesGroup(p) === 'with_sides'),
      ),
    [packages],
  )

  const fromWithSidesSection = useMemo(
    () =>
      packagesWithSides.some((pkg) => pkg.id === state.packageId),
    [packagesWithSides, state.packageId],
  )

  const optionGroupsForPackage = useMemo(() => {
    const cache = new Map<string, PackageOptionGroup[]>()
    return (packageId: string) => {
      if (!packageId?.trim()) return []
      if (!cache.has(packageId)) {
        cache.set(
          packageId,
          mergeOptionGroupsForPackage(
            packageId,
            flatOptionGroups,
            flatOptionGroupItems,
            { includeEmptyGroups: true },
          ),
        )
      }
      return cache.get(packageId) ?? []
    }
  }, [flatOptionGroups, flatOptionGroupItems])

  const activePackageOptionGroups = useMemo(
    () =>
      state.packageId
        ? optionGroupsForPackage(state.packageId)
        : [],
    [state.packageId, optionGroupsForPackage],
  )

  const selectableActivePackageOptionGroups = useMemo(
    () => activePackageOptionGroups.filter((group) => group.items.length > 0),
    [activePackageOptionGroups],
  )

  const blockedCatalogItemIds = useMemo(() => {
    if (!state.packageId || !selectedPackage) return []
    return getBlockedCatalogItemIds(
      state.packageId,
      flatOptionGroups,
      isCustomPackage(selectedPackage),
      {
        packageItems,
        packageSideItems,
        groupItems: flatOptionGroupItems,
        selectedPackageOptions: state.packageSelections,
      },
    )
  }, [
    state.packageId,
    state.packageSelections,
    flatOptionGroups,
    flatOptionGroupItems,
    packageItems,
    packageSideItems,
    selectedPackage,
  ])

  const visibleAdditionalItems = useMemo(
    () =>
      filterCatalogItems(itemCatalog, 'additional', 'customer').filter(
        (item) => !blockedCatalogItemIds.includes(item.id),
      ),
    [itemCatalog, blockedCatalogItemIds],
  )

  const additionalItemsByCategory = useMemo(
    () => groupAdditionalItemsByCategory(visibleAdditionalItems, uiLocale),
    [visibleAdditionalItems, uiLocale],
  )

  const selectedCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const { categoryKey, items } of additionalItemsByCategory) {
      counts[categoryKey] = items.reduce(
        (sum, item) => sum + (state.additionals[item.id] ?? 0),
        0,
      )
    }
    return counts
  }, [additionalItemsByCategory, state.additionals])

  useEffect(() => {
    if (blockedCatalogItemIds.length === 0) return
    setState((prev) => {
      let changed = false
      const nextAdditionals = { ...prev.additionals }
      for (const itemId of blockedCatalogItemIds) {
        if (nextAdditionals[itemId]) {
          delete nextAdditionals[itemId]
          changed = true
        }
      }
      if (!changed) return prev
      return { ...prev, additionals: nextAdditionals }
    })
  }, [blockedCatalogItemIds])

  function markAdditionalCategoryVisited(categoryKey: string) {
    if (!categoryKey) return
    setVisitedAdditionalCategories((prev) => {
      if (prev.has(categoryKey)) return prev
      const next = new Set(prev)
      next.add(categoryKey)
      return next
    })
  }

  function toggleAdditionalCategory(category: string) {
    setOpenAdditionalCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  function handleAdditionalCategoryExpose(categoryKey: string) {
    if (!extrasExposeArmedRef.current) return
    markAdditionalCategoryVisited(categoryKey)
  }

  function armExtrasExposeAfterUserScroll() {
    extrasExposeArmedRef.current = false
    const arm = () => {
      extrasExposeArmedRef.current = true
    }
    window.addEventListener('wheel', arm, { once: true, passive: true })
    window.addEventListener('touchmove', arm, { once: true, passive: true })
    window.addEventListener('keydown', arm, { once: true })
  }

  const previewAdditionals = useMemo(
    () =>
      Object.entries(state.additionals)
        .filter(([, quantity]) => quantity > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity })),
    [state.additionals],
  )

  const publicPreviewEvent = useMemo(
    () =>
      isPublicMode
        ? {
            eventDate: state.eventDate,
            startTime: state.startTime,
            endTime: state.endTime,
            address: {
              route: state.address,
              number: state.addressNumber,
              city: state.city,
              region: state.state,
              postalCode: state.zipCode,
              country: state.addressCountry,
              formattedAddress: state.addressFormatted,
              placeId: state.addressPlaceId,
              latitude: state.addressLatitude,
              longitude: state.addressLongitude,
              source: state.addressSource,
            },
          }
        : undefined,
    [
      isPublicMode,
      state.eventDate,
      state.startTime,
      state.endTime,
      state.address,
      state.addressNumber,
      state.city,
      state.state,
      state.zipCode,
      state.addressCountry,
      state.addressFormatted,
      state.addressPlaceId,
      state.addressLatitude,
      state.addressLongitude,
      state.addressSource,
    ],
  )

  const pricingPreview = useQuotePricingPreview({
    packageId: state.packageId,
    additionals: previewAdditionals,
    adultCount: state.adultCount,
    childrenUnder3Count: state.childrenUnder3Count,
    children4To12Count: state.children4To12Count,
    eventDate: state.eventDate,
    mileageDistance: isPublicMode ? 0 : state.distance,
    grillRentalRequired: state.grillRentalRequired,
    grillRentalQty: state.grillRentalQty,
    reservationPercentage: isPublicMode ? null : state.reservationPercentage,
    language: state.language,
    enabled:
      Boolean(state.packageId?.trim()) &&
      (!isPublicMode || step === 5),
    endpoint: isPublicMode
      ? '/api/public/quote-intake/preview'
      : '/api/quotes/preview',
    event: publicPreviewEvent,
  })

  const pricingBreakdown: PricingBreakdown | null =
    pricingPreview.data?.breakdown ?? null

  useEffect(() => {
    if (!pricingBreakdown) return
    setState((prev) => ({
      ...prev,
      reservationPercentage:
        pricingBreakdown.rules_applied.reservationPercentage,
      reservationAmount: pricingBreakdown.deposit,
    }))
  }, [pricingBreakdown?.computed_at, pricingBreakdown?.deposit, pricingBreakdown?.rules_applied.reservationPercentage])

  const billableGuestCount =
    pricingBreakdown?.guest_counts.billable_guest_count ??
    pricingPreview.data?.totals.billableGuestCount ??
    0
  const reservationAmount = pricingBreakdown?.deposit ?? 0

  const selectedAdditionalsByCategory = useMemo(() => {
    return additionalItemsByCategory
      .map(({ categoryKey, categoryLabel, items }) => ({
        categoryKey,
        categoryLabel,
        items: items
          .filter((item) => (state.additionals[item.id] ?? 0) > 0)
          .map((item) =>
            mapSelectedAdditionalRow(
              item,
              state.additionals[item.id] ?? 0,
              billableGuestCount,
              uiLocale,
            ),
          ),
      }))
      .filter(({ items }) => items.length > 0)
  }, [
    additionalItemsByCategory,
    state.additionals,
    billableGuestCount,
    uiLocale,
  ])

  const selectedAdditionals = useMemo(
    () => selectedAdditionalsByCategory.flatMap(({ items }) => items),
    [selectedAdditionalsByCategory],
  )

  const reviewAdditionals = useMemo(
    () =>
      selectedAdditionalsByCategory.flatMap(({ categoryLabel, items }) =>
        items.map(({ item, quantity, unitPrice, perPerson, totalPrice }) => ({
          id: item.id,
          label: getLocalizedAdditionalLabel(item, uiLocale),
          category: categoryLabel,
          quantity,
          unitPrice,
          totalPrice,
          imageUrl: getCatalogItemImageUrl(item),
          itemType: item.item_type,
          categoryPt: item.category_pt,
          perPerson,
        })),
      ),
    [selectedAdditionalsByCategory, uiLocale],
  )

  const additionalsCount = selectedAdditionals.length

  const additionalCategoryKeys = useMemo(
    () => getVisibleAdditionalCategoryKeys(additionalItemsByCategory),
    [additionalItemsByCategory],
  )
  additionalCategoryKeysRef.current = additionalCategoryKeys

  const additionalCategoryDisplayLabels = useMemo(
    () =>
      buildAdditionalCategoryDisplayLabels(
        additionalItemsByCategory.map(({ categoryKey, categoryLabel }) => ({
          categoryKey,
          categoryLabel,
        })),
      ),
    [additionalItemsByCategory],
  )

  const pendingAdditionalCategories = useMemo(() => {
    const pendingKeys = getUnvisitedAdditionalCategoryKeys(
      additionalCategoryKeys,
      visitedAdditionalCategories,
    )
    return pendingKeys.map((key) => ({
      categoryKey: key,
      label: additionalCategoryDisplayLabels.get(key) ?? key,
    }))
  }, [
    additionalCategoryKeys,
    visitedAdditionalCategories,
    additionalCategoryDisplayLabels,
  ])

  function scrollToAdditionalCategory(categoryKey: string) {
    const target = document.getElementById(`additional-category-${categoryKey}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  /** Takes the customer to the first pending summary — never expands it. */
  function handleAdditionalsNextBlockedClick() {
    const firstPending = pendingAdditionalCategories[0]
    if (!firstPending) return
    setAdditionalsReviewPrompt(true)
    setEmphasizedAdditionalCategory(firstPending.categoryKey)
    armExtrasExposeAfterUserScroll()
    window.setTimeout(() => {
      scrollToAdditionalCategory(firstPending.categoryKey)
    }, 50)
  }

  useEffect(() => {
    if (step !== 3) {
      setOpenAdditionalCategories(new Set())
      setAdditionalsReviewPrompt(false)
    }
  }, [step])

  useEffect(() => {
    if (step !== 3) return
    setVisitedAdditionalCategories((prev) =>
      pruneVisitedAdditionalCategories(prev, additionalCategoryKeys),
    )
  }, [step, additionalCategoryKeys])

  const stepStatusCtx = useMemo<StepStatusContext>(
    () => ({
      state,
      selectedCustomer,
      selectedPackage,
      currentStep: step,
      reservationAmount,
      additionalsCount,
      packageOptionGroups: flatOptionGroups,
      packageOptionGroupItems: flatOptionGroupItems,
      commercialRules,
      isEditMode,
      language: uiLocale,
      additionalCategoryKeys,
      visitedAdditionalCategories,
      pricingPreviewReady: Boolean(pricingBreakdown) && !pricingPreview.loading,
      isPublicMode,
    }),
    [
      state,
      selectedCustomer,
      selectedPackage,
      step,
      reservationAmount,
      additionalsCount,
      flatOptionGroups,
      flatOptionGroupItems,
      commercialRules,
      isEditMode,
      uiLocale,
      additionalCategoryKeys,
      visitedAdditionalCategories,
      pricingPreview.loading,
      pricingBreakdown,
      isPublicMode,
    ],
  )

  useEffect(() => {
    const maxReachable = getMaxReachableStep(stepStatusCtx)
    if (step > maxReachable) {
      setStep(maxReachable)
    }
  }, [step, stepStatusCtx])

  const publicDraftSerialized = useMemo(
    () =>
      JSON.stringify(
        buildPublicIntakeDraft(
          state,
          resolvePackageIdForPersistence(packages, state.packageId),
          [...visitedAdditionalCategories],
        ),
      ),
    [state, packages, visitedAdditionalCategories],
  )

  useEffect(() => {
    if (!isPublicMode) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setPublicAutosaveStatus('saving')
      void fetch('/api/public/quote-intake/session', {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: JSON.parse(publicDraftSerialized) as unknown,
          currentStep: step,
          website: '',
        }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error('autosave_failed')
          setPublicAutosaveStatus('saved')
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setPublicAutosaveStatus('error')
        })
    }, 750)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [isPublicMode, publicDraftSerialized, step])

  async function handleGrillPhotoSelected(file: File | null) {
    if (!file) return
    if (isPublicMode) {
      const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
      if (!allowedTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
        setPublicUploadError(
          uiLocale === 'en'
            ? 'Use a JPG, PNG or WebP image up to 5 MB.'
            : uiLocale === 'es'
              ? 'Usa una imagen JPG, PNG o WebP de hasta 5 MB.'
              : 'Use uma imagem JPG, PNG ou WebP de até 5 MB.',
        )
        return
      }
      setPublicUploading(true)
      setPublicUploadError(null)
      try {
        const body = new FormData()
        body.set('photo', file)
        body.set('website', '')
        const response = await fetch('/api/public/quote-intake/upload', {
          method: 'POST',
          body,
        })
        const result = (await response.json().catch(() => null)) as
          | { photo?: { reference?: string; previewUrl?: string }; error?: string }
          | null
        if (!response.ok || !result?.photo?.reference) {
          throw new Error(result?.error || 'upload_failed')
        }
        updateState({
          grillPhotoUrl: result.photo.previewUrl || null,
          grillPhotoReference: result.photo.reference,
          grillPhotoStatus: 'received',
          grillPhotoRequired: true,
          grillPhotoAnswered: true,
        })
      } catch {
        setPublicUploadError(
          uiLocale === 'en'
            ? 'We could not upload the photo. Please try again.'
            : uiLocale === 'es'
              ? 'No pudimos subir la foto. Inténtalo de nuevo.'
              : 'Não foi possível enviar a foto. Tente novamente.',
        )
      } finally {
        setPublicUploading(false)
      }
      return
    }
    const url = URL.createObjectURL(file)
    updateState({
      grillPhotoUrl: url,
      grillPhotoStatus: 'received',
      grillPhotoRequired: true,
      grillPhotoAnswered: true,
    })
  }

  function updateState(patch: Partial<WizardState>) {
    setNavigationIssues([])
    setState((prev) => ({ ...prev, ...patch }))
  }

  function updateContactIdentity(
    field: 'customerFirstName' | 'customerLastName',
    value: string,
  ) {
    setNavigationIssues([])
    setState((prev) => {
      const next = { ...prev, [field]: value }
      const fullName = [next.customerFirstName, next.customerLastName]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ')
      return {
        ...next,
        customerDraftName: fullName,
        eventName: isEditMode ? prev.eventName : fullName,
      }
    })
  }

  function selectCustomer(customerId: string) {
    const customer = localCustomers.find((c) => c.id === customerId)
    if (!customer) {
      updateState({ customerId })
      return
    }

    const eventDefaults = getEventDefaultsFromCustomer(customer)
    setState((prev) => ({
      ...prev,
      customerId,
      customerDraftPhone: customer.phone ?? '',
      customerDraftName: getCustomerDisplayName(customer),
      customerDraftEmail: customer.email ?? '',
      customerPhoneLinkError: null,
      ...eventDefaults,
    }))
  }

  async function lookupCustomerByPhone(phone: string): Promise<string | null> {
    if (!isUsablePhone(phone)) return null

    updateState({ customerPhoneLinking: true, customerPhoneLinkError: null })
    setCustomerLinkSuccess(null)

    try {
      const response = await fetch('/api/customers/lookup-by-phone', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ phone }),
      })
      const result = (await response.json()) as {
        customer?: Customer
        found?: boolean
        error?: string
      }

      if (!response.ok) {
        updateState({
          customerPhoneLinking: false,
          customerPhoneLinkError:
            result.error ?? w.lookupByPhoneError,
        })
        return null
      }

      if (result.customer) {
        const customer = result.customer
        setLocalCustomers((current) => mergeCustomerIntoList(current, customer))
        setCustomerLinkSuccess(w.existingCustomerLinked)

        const eventDefaults = getEventDefaultsFromCustomer(customer)
        setState((prev) => ({
          ...prev,
          customerId: customer.id,
          customerDraftPhone: customer.phone ?? phone,
          customerDraftName: getCustomerDisplayName(customer),
          customerDraftEmail: customer.email ?? prev.customerDraftEmail,
          customerPhoneLinking: false,
          customerPhoneLinkError: null,
          ...eventDefaults,
        }))
        return customer.id
      }

      setState((prev) => ({
        ...prev,
        customerId: null,
        customerPhoneLinking: false,
        customerPhoneLinkError: null,
      }))
      setCustomerLinkSuccess(
        w.newCustomerDraft,
      )
      return null
    } catch {
      updateState({
        customerPhoneLinking: false,
        customerPhoneLinkError: w.networkLookupError,
      })
      return null
    }
  }

  useEffect(() => {
    // Customer matching is deliberately server-side on submit. The browser
    // never receives search results or confirmation that a phone already exists.
    if (isEditMode || entryMode === 'authenticated' || isPublicMode) return
    if (!isUsablePhone(state.customerDraftPhone)) return
    if (
      state.customerId &&
      selectedCustomer?.phone &&
      normalizePhone(selectedCustomer.phone) ===
        normalizePhone(state.customerDraftPhone)
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void lookupCustomerByPhone(state.customerDraftPhone)
    }, 600)

    return () => window.clearTimeout(timer)
  }, [
    isEditMode,
    entryMode,
    isPublicMode,
    state.customerDraftPhone,
    state.customerDraftName,
    state.customerDraftEmail,
    state.customerId,
    selectedCustomer,
  ])

  function selectCustomerAndAdvance(customerId: string) {
    selectCustomer(customerId)
    setStep(1)
  }

  function setGrillPhotoStatus(status: GrillPhotoStatus) {
    updateState({
      grillPhotoStatus: status,
      grillPhotoRequired: grillPhotoStatusToRequired(status),
      grillPhotoAnswered: true,
    })
  }

  useEffect(() => {
    if (step !== 5) return
    const timer = window.setTimeout(() => {
      distanceInputRef.current?.focus()
      distanceInputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [step])

  function setAdditionalQty(itemId: string, quantity: number) {
    const item = itemCatalog.find((row) => row.id === itemId)
    const normalizedQty = item
      ? normalizeAdditionalQuantity(item, quantity)
      : Math.max(0, quantity)

    if (item) {
      markAdditionalCategoryVisited(getAdditionalItemCategoryKey(item))
    }

    setState((prev) => {
      const next = { ...prev.additionals }
      if (normalizedQty <= 0) {
        delete next[itemId]
      } else {
        next[itemId] = normalizedQty
      }
      return { ...prev, additionals: next }
    })
  }

  function goBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  function handlePackageSelectionChange(groupId: string, itemId: string) {
    setState((prev) => ({
      ...prev,
      packageSelections: {
        ...prev.packageSelections,
        [groupId]: itemId,
      },
    }))
    setPackageStepMessage(null)
  }

  function handlePackageSelect(packageId: string | null) {
    if (!packageId) {
      updateState({ packageId: null, packageSelections: {} })
      setVisitedAdditionalCategories(new Set())
      return
    }

    const prunedSelections = prunePackageSelectionsForPackage(
      packageId,
      state.packageSelections,
      flatOptionGroups,
      flatOptionGroupItems,
    )
    const found = findPackageByIdOrKey(packages, packageId)
    if (found) selectedPackageRef.current = found
    if (found?.id !== state.packageId) {
      setVisitedAdditionalCategories(new Set())
    }
    updateState({ packageId: found?.id ?? packageId, packageSelections: prunedSelections })
  }

  function goNext() {
    const categoryKeys = additionalCategoryKeysRef.current
    const visitedCategories = visitedAdditionalCategoriesRef.current

    if (step === 0 || step === 1 || step === 4) {
      const issues = getStepIssues(step, stepStatusCtx)
      if (issues.length > 0) {
        setNavigationIssues(issues)
        return
      }
    }

    if (step === 2 && !state.packageId) {
      setPackageStepMessage(w.selectPackageToContinue)
      return
    }
    if (step === 2 && state.packageId && selectedPackage) {
      if (!isCustomPackage(selectedPackage)) {
        const issues = validatePackageSelections(
          selectableActivePackageOptionGroups,
          state.packageSelections,
          uiLocale,
        )
        if (issues.length > 0) {
          setPackageSelectionAttempted(true)
          setPackageStepMessage(issues[0])
          return
        }
      }
    }
    if (step === 3) {
      const remaining = getUnvisitedAdditionalCategoryKeys(
        categoryKeys,
        visitedCategories,
      )
      if (remaining.length > 0) {
        handleAdditionalsNextBlockedClick()
        return
      }
    }
    const nextStep = resolveNextWizardStep({
      step,
      packageId: state.packageId,
      selectedPackage,
      packageSelections: state.packageSelections,
      selectableActivePackageOptionGroups,
      additionalCategoryKeys: categoryKeys,
      visitedAdditionalCategories: visitedCategories,
      state,
      uiLocale,
    })

    if (nextStep === step) {
      return
    }

    setPackageSelectionAttempted(false)
    setPackageStepMessage(null)
    setStep(nextStep)
  }

  useEffect(() => {
    if (state.packageId) {
      setPackageStepMessage(null)
      setPackageSelectionAttempted(false)
    }
  }, [state.packageId, state.packageSelections])

  const pendingSelectionGroupIds = useMemo(() => {
    if (!packageSelectionAttempted || !selectedPackage) return []
    if (isCustomPackage(selectedPackage)) return []
    return getPendingPackageSelectionGroupIds(
      selectableActivePackageOptionGroups,
      state.packageSelections,
    )
  }, [
    packageSelectionAttempted,
    selectedPackage,
    selectableActivePackageOptionGroups,
    state.packageSelections,
  ])

  const allOptionGroupItems = useMemo(
    () =>
      flatOptionGroupItems.length > 0
        ? flatOptionGroupItems
        : flattenPackageOptionGroupItems(flatOptionGroups),
    [flatOptionGroups, flatOptionGroupItems],
  )

  const activePackageOptionGroupItems = useMemo(
    () => flattenPackageOptionGroupItems(activePackageOptionGroups),
    [activePackageOptionGroups],
  )

  useEffect(() => {
    if (step !== 2 || process.env.NODE_ENV === 'production') return
    console.log('[Etapa Pacote] packages', packages)
    console.log('[Etapa Pacote] packageOptionGroups', flatOptionGroups)
    console.log('[Etapa Pacote] packageOptionGroupItems', allOptionGroupItems)
    console.log('[Etapa Pacote] companyId', debugCompanyId)
    console.log(
      '[Etapa Pacote] activePackageOptionGroups',
      activePackageOptionGroups,
    )
    console.log(
      '[Etapa Pacote] activePackageOptionGroupItems',
      activePackageOptionGroupItems,
    )
    console.log('[Etapa Pacote] selectedPackage', selectedPackage)
    console.log('[Etapa Pacote] selectedPackageOptions', state.packageSelections)
    console.log('[Etapa Pacote] blockedCatalogItemIds', blockedCatalogItemIds)
    if (
      activePackageOptionGroups.length > 0 &&
      activePackageOptionGroupItems.length === 0
    ) {
      console.warn(
        '[Etapa Pacote] grupos sem itens anexados — verificar package_option_group_items',
      )
    }
  }, [
    step,
    packages,
    flatOptionGroups,
    allOptionGroupItems,
    debugCompanyId,
    activePackageOptionGroups,
    activePackageOptionGroupItems,
    selectedPackage,
    state.packageSelections,
    blockedCatalogItemIds,
  ])

  const packageStepNextDisabled = useMemo(() => {
    if (!state.packageId) return true
    if (!selectedPackage || isCustomPackage(selectedPackage)) return false
    return (
      getPendingPackageSelectionGroupIds(
        selectableActivePackageOptionGroups,
        state.packageSelections,
      ).length > 0
    )
  }, [
    state.packageId,
    selectedPackage,
    selectableActivePackageOptionGroups,
    state.packageSelections,
  ])

  const allAdditionalCategoriesVisited = useMemo(
    () =>
      canAdvanceFromAdditionalsStep(
        additionalCategoryKeys,
        visitedAdditionalCategories,
      ),
    [additionalCategoryKeys, visitedAdditionalCategories],
  )

  const additionalsStepNextDisabled =
    additionalCategoryKeys.length > 0 && !allAdditionalCategoriesVisited

  const grillStepPendingIssues = useMemo(() => {
    const issues: string[] = []
    if (isGrillPhotoRequiredAndMissing(state)) {
      issues.push(tw(uiLocale, 'grillPendingPhoto'))
    }
    if (state.grillRentalRequired && state.grillRentalQty <= 0) {
      issues.push(tw(uiLocale, 'grillPendingRentalQty'))
    }
    return issues
  }, [
    state.hasGrill,
    state.grillPhotoStatus,
    state.grillPhotoUrl,
    state.grillPhotoReference,
    state.grillRentalRequired,
    state.grillRentalQty,
    uiLocale,
  ])

  useEffect(() => {
    const previousStep = previousStepRef.current
    previousStepRef.current = step
    if (step === 2 && previousStep === 1 && !isEditMode) {
      updateState({ packageId: null, packageSelections: {} })
    }
  }, [step, isEditMode])

  const mandatoryPendingSteps = useMemo(
    () => getMandatoryPendingSteps(stepStatusCtx),
    [stepStatusCtx],
  )

  const quoteReady = isQuoteReadyToSave(stepStatusCtx)

  async function handleSaveQuote(openReview = false) {
    if (saving) return

    if (mandatoryPendingSteps.length > 0) {
      const errorInfo = buildSaveQuoteError(
        'validation',
        new Error(w.pendingPreviousSteps),
      )
      setSaveErrorInfo(errorInfo)
      return
    }

    const customerIdToSave = isEditMode
      ? state.customerId ??
        (existingSnapshot as { customer_id?: string | null } | undefined)
          ?.customer_id ??
        null
      : state.customerId ?? selectedCustomer?.id ?? null

    if (!state.packageId) {
      const errorInfo = buildSaveQuoteError(
        'validation',
        new Error(w.packageNotSelected),
      )
      setSaveErrorInfo(errorInfo)
      return
    }

    const packageForSave =
      selectedPackage ??
      findPackageByIdOrKey(packages, state.packageId) ??
      null

    if (!packageForSave) {
      const errorInfo = buildSaveQuoteError(
        'validation',
        new Error(w.packageNotInCatalog),
      )
      setSaveErrorInfo(errorInfo)
      return
    }

    if (isPublicMode) {
      if (!state.publicConsentAccepted || !publicContext?.consentVersion) {
        setSaveErrorInfo(
          buildSaveQuoteError(
            'validation',
            new Error('Consentimento obrigatório.'),
          ),
        )
        return
      }
      if (!pricingBreakdown) {
        setSaveErrorInfo(
          buildSaveQuoteError(
            'validation',
            new Error('A estimativa ainda está sendo calculada.'),
          ),
        )
        return
      }

      setSaving(true)
      setSaveErrorInfo(null)
      try {
        publicIdempotencyKeyRef.current ??= crypto.randomUUID()
        const response = await fetch('/api/public/quote-intake/submit', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey: publicIdempotencyKeyRef.current,
            submission: buildPublicIntakeDraft({
              ...state,
              eventName:
                state.eventName.trim() ||
                [state.customerFirstName, state.customerLastName]
                  .map((value) => value.trim())
                  .filter(Boolean)
                  .join(' '),
            }),
            consent: {
              accepted: true,
              version: publicContext.consentVersion,
            },
            website: '',
          }),
        })
        const result = (await response.json().catch(() => null)) as
          | PublicQuoteSubmissionResult
          | { error?: string }
          | null
        if (
          !response.ok ||
          !result ||
          !('quote' in result) ||
          !result.quote?.id
        ) {
          throw new Error(
            result && 'error' in result && result.error
              ? result.error
              : 'public_submit_failed',
          )
        }
        onPublicSuccess?.(result)
      } catch (error) {
        setSaveErrorInfo(buildSaveQuoteError('quote', error))
      } finally {
        setSaving(false)
      }
      return
    }

    setSaving(true)
    setSaveErrorInfo(null)

    const currentPricingFingerprint = buildPricingFingerprint(state)
    const recalculateSnapshot =
      !isEditMode ||
      currentPricingFingerprint !== (initialPricingFingerprint ?? '')

    const payload: QuoteSaveInput = {
      language: state.language,
      source: 'assisted_self_service',
      customerId: customerIdToSave,
      customerDraft:
        !isEditMode && !customerIdToSave && isUsablePhone(state.customerDraftPhone)
          ? {
              phone: state.customerDraftPhone,
              name: state.customerDraftName || null,
              email: state.customerDraftEmail || null,
            }
          : null,
      packageId: packageForSave.id,
      branchId: state.branchId ?? tenantBranchId ?? null,
      eventName: state.eventName,
      eventDate: state.eventDate,
      startTime: state.startTime,
      endTime: state.endTime,
      adultCount: state.adultCount,
      childrenUnder3Count: state.childrenUnder3Count,
      children4To12Count: state.children4To12Count,
      address: state.address,
      addressNumber: state.addressNumber,
      city: state.city,
      state: state.state,
      zipCode: state.zipCode,
      hasGrill: state.hasGrill,
      grillPhotoRequired: state.grillPhotoRequired,
      grillRentalRequired: state.grillRentalRequired,
      grillRentalQty: state.grillRentalQty,
      grillNotes: state.grillNotes,
      baseLocation: state.baseLocation,
      distance: state.distance,
      pricing: commercialRules,
      reservationPercentage: state.reservationPercentage,
      reservationAmount,
      packagePricePerPerson: getPackagePrice(packageForSave),
      packageSelections: isCustomPackage(packageForSave)
        ? []
        : selectableActivePackageOptionGroups
            .map((group) => {
              const optionItemId = state.packageSelections[group.id]?.trim()
              if (!optionItemId) return null
              return {
                optionGroupId: group.id,
                optionItemId,
                packageId: packageForSave.id,
              }
            })
            .filter(
              (
                line,
              ): line is {
                optionGroupId: string
                optionItemId: string
                packageId: string
              } => line !== null,
            ),
      additionals: selectedAdditionals.map(
        ({ item, quantity, unitPrice, perPerson, totalPrice }) => ({
          itemId: item.id,
          quantity,
          unitPrice,
          perPerson,
          totalPrice,
        }),
      ),
      recalculateSnapshot,
      existingSnapshot: isEditMode ? existingSnapshot : undefined,
    }

    try {
      const result = await saveQuoteViaApi(
        payload,
        isEditMode ? { quoteId: quoteId! } : undefined,
      )

      if (result.error || !result.data?.id) {
        const errorInfo = normalizeSaveQuoteError(
          result.error ??
            new Error(w.quoteNotCreated),
          isEditMode ? 'quote' : 'quote',
        )
        logSaveQuoteError(errorInfo, result.error)
        setSaveErrorInfo(errorInfo)
        return
      }

      const createdId = result.data.id
      const params = new URLSearchParams()
      params.set(isEditMode ? 'updated' : 'created', '1')
      if (openReview) {
        params.set('review', '1')
      }
      router.push(`/quotes/${createdId}?${params.toString()}`)
    } catch (error) {
      const errorInfo = normalizeSaveQuoteError(error, 'quote')
      logSaveQuoteError(errorInfo, error)
      setSaveErrorInfo(errorInfo)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main
      className={`quotes-pscs min-h-screen min-w-0 max-w-full bg-cdl-bg px-4 pb-28 text-cdl-fg sm:px-8 sm:pb-28 ${
        isPublicMode ? 'py-6 sm:py-10' : 'py-4 sm:py-6'
      }`}
    >
      <div className="mx-auto min-w-0 max-w-6xl">
        {isPublicMode ? (
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                {uiLocale === 'en'
                  ? `Step ${step + 1} of ${WIZARD_STEP_COUNT}`
                  : uiLocale === 'es'
                    ? `Paso ${step + 1} de ${WIZARD_STEP_COUNT}`
                    : `Etapa ${step + 1} de ${WIZARD_STEP_COUNT}`}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-cdl-title sm:text-3xl">
                {wizardSteps[step]}
              </h1>
            </div>
            <p
              className={`text-xs ${
                publicAutosaveStatus === 'error'
                  ? 'text-amber-700'
                  : 'text-cdl-muted'
              }`}
              aria-live="polite"
            >
              {publicAutosaveStatus === 'saving'
                ? uiLocale === 'en'
                  ? 'Saving…'
                  : uiLocale === 'es'
                    ? 'Guardando…'
                    : 'Salvando…'
                : publicAutosaveStatus === 'saved'
                  ? uiLocale === 'en'
                    ? 'Saved'
                    : uiLocale === 'es'
                      ? 'Guardado'
                      : 'Salvo'
                  : publicAutosaveStatus === 'error'
                    ? uiLocale === 'en'
                      ? 'Will retry'
                      : uiLocale === 'es'
                        ? 'Reintentaremos'
                        : 'Tentaremos novamente'
                    : ''}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-2">
              <AdminCompactMenu language={uiLocale} />
              <Link
                href={isEditMode && quoteId ? `/quotes/${quoteId}` : '/quotes'}
                className="inline-flex items-center text-sm text-cdl-muted transition-colors hover:text-cdl-brand"
              >
                {isEditMode
                  ? quoteStrings.backToQuote
                  : quoteStrings.backToQuotes}
              </Link>
            </div>
            <QuoteStepHeader
              step={step}
              language={uiLocale}
              isEditMode={isEditMode}
            />
          </>
        )}

        <QuoteStepper
          steps={wizardSteps}
          shortSteps={quoteStrings.wizardStepsShort}
          currentStep={step}
          additionalsCount={additionalsCount}
          language={uiLocale}
          getStepStatus={(index) => getStepVisualStatus(index, stepStatusCtx)}
          onStepClick={(nextStep) => {
            if (!canNavigateToStep(nextStep, stepStatusCtx)) return
            setNavigationIssues([])
            setStep(nextStep)
          }}
        />

        {fetchErrors.length > 0 && (
          <div className="mb-6 rounded-3xl border border-red-500/40 bg-cdl-surface p-4 text-sm text-red-400">
            {isPublicMode ? (
              <p>
                {uiLocale === 'en'
                  ? 'Some options could not be loaded. Refresh and try again.'
                  : uiLocale === 'es'
                    ? 'No se pudieron cargar algunas opciones. Actualiza e inténtalo de nuevo.'
                    : 'Algumas opções não puderam ser carregadas. Atualize e tente novamente.'}
              </p>
            ) : (
              fetchErrors.map((msg) => <p key={msg}>{msg}</p>)
            )}
          </div>
        )}

        {navigationIssues.length > 0 ? (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          >
            <p className="font-bold">
              {uiLocale === 'en'
                ? 'Complete the highlighted information:'
                : uiLocale === 'es'
                  ? 'Completa la información destacada:'
                  : 'Complete as informações destacadas:'}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {navigationIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 0 && isEditMode ? (
          <SectionCard>
            <div className="sm:col-span-2">
              <label className="flex flex-col gap-2">
                <span className="cdl-eyebrow">{quoteStrings.documentLanguage}</span>
                <select
                  value={state.language}
                  onChange={(e) =>
                    updateState({
                      language: e.target.value as 'pt' | 'en' | 'es',
                    })
                  }
                  className="rounded-xl border border-cdl-border bg-cdl-inset px-4 py-3 text-sm text-cdl-fg outline-none focus:border-cdl-accent-border"
                >
                  <option value="pt">{w.langPt}</option>
                  <option value="en">{w.langEn}</option>
                  <option value="es">{w.langEs}</option>
                </select>
              </label>
            </div>
            <div className="sm:col-span-2 rounded-xl border border-cdl-border bg-cdl-inset p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-cdl-muted">
                {quoteStrings.currentCustomer}
              </p>
              <p className="mt-2 text-xl font-black text-cdl-title">
                {editCustomerDisplayName}
              </p>
              {linkedCustomer?.email ? (
                <p className="mt-1 text-sm text-cdl-muted">{linkedCustomer.email}</p>
              ) : null}
              {linkedCustomer?.phone ? (
                <p className="text-sm text-cdl-muted">{linkedCustomer.phone}</p>
              ) : null}
              {!linkedCustomer && state.customerId ? (
                <p className="mt-2 font-mono text-xs text-cdl-subtle">
                  ID: {state.customerId}
                </p>
              ) : null}
              <p className="mt-4 text-sm text-cdl-text-secondary">
                {quoteStrings.customerLocked}
              </p>
            </div>
          </SectionCard>
        ) : null}

        {step === 0 && !isEditMode && (
          <SectionCard>
            {!isPublicMode ? (
              <div className="sm:col-span-2">
              <label className="flex flex-col gap-2">
                <span className="cdl-eyebrow">{quoteStrings.documentLanguage}</span>
                <select
                  value={state.language}
                  onChange={(e) =>
                    updateState({
                      language: e.target.value as 'pt' | 'en' | 'es',
                    })
                  }
                  className="rounded-xl border border-cdl-border bg-cdl-inset px-4 py-3 text-sm text-cdl-fg outline-none focus:border-cdl-accent-border"
                >
                  <option value="pt">{w.langPt}</option>
                  <option value="en">{w.langEn}</option>
                  <option value="es">{w.langEs}</option>
                </select>
                <p className="text-xs text-cdl-muted">
                  {quoteStrings.documentLanguageHint}
                </p>
              </label>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
              <InputField
                label={w.firstName}
                value={state.customerFirstName}
                onChange={(value) =>
                  updateContactIdentity('customerFirstName', value)
                }
                autoComplete="given-name"
                completion={getFieldCompletion(state.customerFirstName)}
              />
              <InputField
                label={w.lastName}
                value={state.customerLastName}
                onChange={(value) =>
                  updateContactIdentity('customerLastName', value)
                }
                autoComplete="family-name"
                completion={getFieldCompletion(state.customerLastName)}
              />
              {isPublicMode ? (
                <PublicPhoneField
                  value={state.customerDraftPhone}
                  language={uiLocale}
                  onChange={(value) =>
                    updateState({
                      customerDraftPhone: value,
                      customerId: null,
                      customerPhoneLinkError: null,
                    })
                  }
                />
              ) : (
                <InputField
                  label={w.customerPhone}
                  type="tel"
                  value={state.customerDraftPhone}
                  onChange={(value) =>
                    updateState({
                      customerDraftPhone: value,
                      customerId: null,
                      customerPhoneLinkError: null,
                    })
                  }
                  placeholder={tCommon(uiLocale, 'phonePlaceholder')}
                  autoComplete="tel"
                  completion={
                    isUsablePhone(state.customerDraftPhone) ? 'filled' : 'empty'
                  }
                />
              )}
              <InputField
                label={`${w.customerEmail} (${
                  uiLocale === 'en'
                    ? 'optional'
                    : uiLocale === 'es'
                      ? 'opcional'
                      : 'opcional'
                })`}
                value={state.customerDraftEmail}
                type="email"
                onChange={(value) =>
                  updateState({ customerDraftEmail: value })
                }
                placeholder="email@exemplo.com"
                autoComplete="email"
                completion={getFieldCompletion(state.customerDraftEmail)}
              />
            </div>

            {(isPublicMode
              ? state.customerDraftPhone.replace(/\D/g, '').length >= 4 &&
                !isUsablePublicPhone(state.customerDraftPhone)
              : normalizePhone(state.customerDraftPhone).length >= 10 &&
                !isUsablePhone(state.customerDraftPhone)) ? (
              <p className="sm:col-span-2 text-sm text-cdl-action">
                {tCommon(uiLocale, 'invalidPhone')}
              </p>
            ) : null}
            <p className="sm:col-span-2 rounded-xl border border-cdl-border-subtle bg-cdl-inset px-4 py-3 text-sm leading-relaxed text-cdl-muted">
              {w.contactPrivacyHint}
            </p>
          </SectionCard>
        )}

        {step === 1 && (
          <SectionCard>
            <div className="grid grid-cols-1 gap-4 sm:col-span-2">
              {isEditMode ? (
                <InputField
                  label={w.eventName}
                  value={state.eventName}
                  onChange={(value) => updateState({ eventName: value })}
                  placeholder={w.eventNamePlaceholder}
                  completion={getFieldCompletion(state.eventName)}
                />
              ) : (
                <p className="rounded-xl border border-cdl-border-subtle bg-cdl-inset px-4 py-3 text-sm text-cdl-muted">
                  {uiLocale === 'en'
                    ? `Request for ${state.customerDraftName || 'your event'}`
                    : uiLocale === 'es'
                      ? `Solicitud para ${state.customerDraftName || 'tu evento'}`
                      : `Solicitação para ${state.customerDraftName || 'seu evento'}`}
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <DatePickerField
                  label={w.eventDate}
                  value={state.eventDate}
                  onChange={(v) => updateState({ eventDate: v })}
                  completion={getFieldCompletion(state.eventDate)}
                  language={uiLocale}
                />
                <TimePickerField
                  label={w.startTime}
                  language={uiLocale}
                  value={state.startTime}
                  onChange={(v) =>
                    setState((prev) => ({
                      ...prev,
                      startTime: v,
                      endTime:
                        isPublicMode || !endTimeCustomized
                          ? deriveEventEndTime(v, serviceDurationMinutes)
                          : prev.endTime,
                    }))
                  }
                  completion={getFieldCompletion(state.startTime)}
                />
                <div>
                  <TimePickerField
                    label={w.endTime}
                    language={uiLocale}
                    value={state.endTime}
                    readOnly={isPublicMode}
                    onChange={(v) => {
                      if (isPublicMode) return
                      setEndTimeCustomized(true)
                      updateState({ endTime: v })
                    }}
                    completion={getFieldCompletion(state.endTime)}
                  />
                  <p className="mt-2 text-xs text-cdl-subtle">
                    {isPublicMode ? w.endTimeHintPublic : w.endTimeHint}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <QuantityField
                  label={w.adults}
                  value={state.adultCount}
                  onChange={(v) => updateState({ adultCount: v })}
                  completion={getFieldCompletion(state.adultCount)}
                />
                <QuantityField
                  label={w.childrenUnder3}
                  value={state.childrenUnder3Count}
                  onChange={(v) => updateState({ childrenUnder3Count: v })}
                />
                <QuantityField
                  label={w.children4to12}
                  value={state.children4To12Count}
                  onChange={(v) => updateState({ children4To12Count: v })}
                />
              </div>
              <AddressAutocompleteFields
                values={{
                  address: state.address,
                  addressNumber: state.addressNumber,
                  city: state.city,
                  state: state.state,
                  zipCode: state.zipCode,
                  addressFormatted: state.addressFormatted,
                  addressPlaceId: state.addressPlaceId,
                  addressCountry: state.addressCountry,
                  addressLatitude: state.addressLatitude,
                  addressLongitude: state.addressLongitude,
                  addressSource: state.addressSource,
                }}
                fieldCompletions={{
                  city: getFieldCompletion(state.city),
                  state: getFieldCompletion(state.state),
                  zipCode: isUsablePostalCode(state.zipCode)
                    ? 'filled'
                    : 'empty',
                }}
                onChange={(patch) => updateState(patch)}
                language={uiLocale}
                allowedCountries={publicContext?.allowedCountries}
                locationBias={
                  isPublicMode ? publicContext?.locationBias ?? null : null
                }
              />
            </div>
          </SectionCard>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {packages.length === 0 ? (
              <div className="rounded-2xl border border-red-500/40 bg-cdl-surface p-6 text-sm text-red-300">
                {fetchErrors.some((e) => /pacote|package/i.test(e))
                  ? tw(uiLocale, 'packagesLoadError')
                  : w.noPackages}
              </div>
            ) : null}
            {isPublicMode ? (
              <PublicPackageCatalog
                packagesWithoutSides={packagesWithoutSides}
                packagesWithSides={packagesWithSides}
                allPackages={packages}
                selectedPackageId={state.packageId}
                language={state.language}
                sidesPricePerPerson={commercialRules.sidesPricePerPerson}
                optionGroupsForPackage={optionGroupsForPackage}
                selections={state.packageSelections}
                onSelectionChange={handlePackageSelectionChange}
                pendingSelectionGroupIds={pendingSelectionGroupIds}
                onSelect={handlePackageSelect}
              />
            ) : (
              <QuotePackageStepExplorer
                packagesWithoutSides={packagesWithoutSides}
                packagesWithSides={packagesWithSides}
                allPackages={packages}
                selectedPackageId={state.packageId}
                language={state.language}
                sidesPricePerPerson={commercialRules.sidesPricePerPerson}
                optionGroupsForPackage={optionGroupsForPackage}
                packageItems={packageItems}
                packageSideItems={packageSideItems}
                catalogItems={itemCatalog}
                selections={state.packageSelections}
                onSelectionChange={handlePackageSelectionChange}
                pendingSelectionGroupIds={pendingSelectionGroupIds}
                onSelect={handlePackageSelect}
                onNext={goNext}
                nextDisabled={packageStepNextDisabled}
                onNextBlockedClick={() => {
                  if (!state.packageId) {
                    setPackageStepMessage(w.selectPackageToContinue)
                    return
                  }
                  setPackageSelectionAttempted(true)
                }}
                stepMessage={packageStepMessage}
              />
            )}

            {!isPublicMode && process.env.NODE_ENV !== 'production' ? (
              <PackageOptionsDebugPanel
                companyId={debugCompanyId}
                selectedPackage={selectedPackage}
                optionGroups={flatOptionGroups}
                optionGroupItems={flatOptionGroupItems}
                packageItems={packageItems}
                packageSideItems={packageSideItems}
                queryDebug={packageOptionQueryDebugForPanel}
                flatGroupsTotal={flatOptionGroups.length}
              />
            ) : null}
          </div>
        )}

        {step === 3 && (
          <div className="min-w-0 space-y-6">
            <p className="text-sm text-cdl-muted">
              {quoteStrings.additionalsStepHint}
            </p>
            {additionalItemsByCategory.length === 0 ? (
              <p className="text-sm text-cdl-muted">
                {quoteStrings.noAdditionalsAvailable}
              </p>
            ) : (
              <div className="space-y-4">
                {additionalItemsByCategory.map(
                  ({ categoryKey, categoryLabel, items }) => (
                  <AdditionalCategorySection
                    key={categoryKey}
                    categoryKey={categoryKey}
                    categoryLabel={
                      additionalCategoryDisplayLabels.get(categoryKey) ??
                      categoryLabel
                    }
                    items={items}
                    expanded={openAdditionalCategories.has(categoryKey)}
                    selectedCount={selectedCountByCategory[categoryKey] ?? 0}
                    visited={visitedAdditionalCategories.has(categoryKey)}
                    emphasize={emphasizedAdditionalCategory === categoryKey}
                    quantities={state.additionals}
                    billableGuestCount={billableGuestCount}
                    language={uiLocale}
                    onToggle={() => toggleAdditionalCategory(categoryKey)}
                    onExpose={() => handleAdditionalCategoryExpose(categoryKey)}
                    onChangeQty={setAdditionalQty}
                  />
                ),
                )}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            {grillStepPendingIssues.length > 0 ? (
              <section className="rounded-2xl border border-cdl-action/40 bg-cdl-red-soft p-5 shadow-cdl sm:p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-cdl-action">
                  {tw(uiLocale, 'stepPendingTitle')}
                </h2>
                <ul className="mt-3 space-y-1 text-sm text-cdl-text-secondary">
                  {grillStepPendingIssues.map((issue) => (
                    <li key={issue} className="flex gap-2">
                      <span className="text-cdl-action" aria-hidden>
                        •
                      </span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <SectionCard>
            <div className="grid grid-cols-1 gap-5 sm:col-span-2 sm:grid-cols-2">
              <fieldset className="sm:col-span-2">
                <legend className="cdl-eyebrow">{w.hasGrill}</legend>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    {
                      value: true,
                      label:
                        uiLocale === 'en'
                          ? 'Yes, there is a grill'
                          : uiLocale === 'es'
                            ? 'Sí, hay parrilla'
                            : 'Sim, há churrasqueira',
                    },
                    {
                      value: false,
                      label:
                        uiLocale === 'en'
                          ? 'No grill on site'
                          : uiLocale === 'es'
                            ? 'No hay parrilla'
                            : 'Não há churrasqueira',
                    },
                  ].map((option) => {
                    const selected =
                      state.grillSetupAnswered &&
                      state.hasGrill === option.value
                    return (
                      <button
                        key={String(option.value)}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          updateState(
                            option.value
                              ? {
                                  hasGrill: true,
                                  grillSetupAnswered: true,
                                  grillPhotoStatus: 'pending',
                                  grillPhotoRequired: true,
                                  grillPhotoAnswered: false,
                                  grillRentalRequired: false,
                                  grillRentalQty: 0,
                                }
                              : {
                                  hasGrill: false,
                                  grillSetupAnswered: true,
                                  grillPhotoStatus: 'not_applicable',
                                  grillPhotoRequired: false,
                                  grillPhotoAnswered: true,
                                  grillPhotoUrl: null,
                                  grillPhotoReference: null,
                                },
                          )
                        }
                        className={`min-h-16 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                          selected
                            ? 'border-[var(--brand-primary-2)] bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] text-[var(--brand-primary)] ring-2 ring-[color-mix(in_srgb,var(--brand-primary-2)_24%,transparent)]'
                            : 'border-cdl-border bg-cdl-surface text-cdl-title hover:border-cdl-accent-border'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              {isEditMode ? (
                <div className="sm:col-span-2">
                  <GrillPhotoStatusField
                    value={state.grillPhotoStatus}
                    disabled={!state.hasGrill}
                    onChange={setGrillPhotoStatus}
                    language={uiLocale}
                  />
                </div>
              ) : null}

              {state.grillSetupAnswered && state.hasGrill ? (
                <div className="sm:col-span-2 rounded-2xl border border-cdl-border bg-cdl-inset p-5">
                <input
                  ref={grillPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handleGrillPhotoSelected(e.target.files?.[0] ?? null)
                  }}
                />
                <button
                  type="button"
                  disabled={publicUploading}
                  onClick={() => grillPhotoInputRef.current?.click()}
                  className="inline-flex items-center justify-center rounded-xl border border-cdl-border bg-cdl-inset px-4 py-3 text-xs font-bold uppercase tracking-wider text-cdl-fg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publicUploading
                    ? uiLocale === 'en'
                      ? 'Uploading…'
                      : uiLocale === 'es'
                        ? 'Subiendo…'
                        : 'Enviando…'
                    : w.attachGrillPhoto}
                </button>
                {state.grillPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.grillPhotoUrl}
                    alt=""
                    className="mt-3 max-h-48 rounded-xl border border-cdl-border object-cover"
                  />
                ) : null}
                <p className="mt-3 rounded-xl border border-cdl-border-subtle bg-cdl-inset px-4 py-3 text-sm leading-relaxed text-cdl-text-secondary">
                  {w.grillPhotoHint}
                </p>
                {publicUploadError ? (
                  <p className="mt-3 text-sm text-cdl-action" role="alert">
                    {publicUploadError}
                  </p>
                ) : null}
              </div>
              ) : null}

              {state.grillSetupAnswered && !state.hasGrill ? (
                <>
                  <div className="sm:col-span-1">
                    <CheckboxField
                      label={w.grillRentalRequired}
                      checked={state.grillRentalRequired}
                      onChange={(value) =>
                        updateState({
                          grillRentalRequired: value,
                          grillRentalQty: value
                            ? Math.max(1, state.grillRentalQty)
                            : 0,
                        })
                      }
                    />
                  </div>
                  <QuantityField
                    label={w.grillRentalQty}
                    value={state.grillRentalQty}
                    min={state.grillRentalRequired ? 1 : 0}
                    disabled={!state.grillRentalRequired}
                    placeholder={state.grillRentalRequired ? '1' : '0'}
                    onChange={(value) =>
                      updateState({
                        grillRentalQty: state.grillRentalRequired
                          ? Math.max(1, value)
                          : 0,
                      })
                    }
                  />
                </>
              ) : null}
              <div className="sm:col-span-2">
                <label className="flex flex-col gap-2">
                  <span className="cdl-eyebrow">
                    {w.grillNotes}
                  </span>
                  <textarea
                    value={state.grillNotes}
                    onChange={(e) => updateState({ grillNotes: e.target.value })}
                    rows={4}
                    placeholder={w.grillNotesPlaceholder}
                    className="rounded-xl border border-cdl-border bg-cdl-inset px-4 py-3 text-sm text-cdl-fg outline-none transition-colors placeholder:text-cdl-faint focus:border-cdl-accent-border"
                  />
                </label>
              </div>
            </div>
          </SectionCard>
          </div>
        )}

        {step === 5 && (
          isPublicMode ? (
            <PublicQuoteConfirmationStep
              state={state}
              breakdown={pricingBreakdown}
              pricingLoading={pricingPreview.loading}
              pricingError={pricingPreview.error}
              onRetryPricing={pricingPreview.refresh}
              customerName={
                [state.customerFirstName, state.customerLastName]
                  .filter(Boolean)
                  .join(' ')
                  .trim() || w.customerNotLinkedShort
              }
              packageName={
                selectedPackage
                  ? getPackageName(selectedPackage, uiLocale)
                  : null
              }
              packageImageUrl={packageImageUrl}
              selectedPackage={selectedPackage}
              allPackages={packages}
              packageOptionGroups={flatOptionGroups}
              packageOptionGroupItems={flatOptionGroupItems}
              packageItems={packageItems}
              packageSideItems={packageSideItems}
              fromWithSidesSection={fromWithSidesSection}
              additionals={reviewAdditionals}
              currency={
                selectedPackage?.currency_code ||
                publicContext?.currencyCode ||
                'USD'
              }
              language={uiLocale}
              consentLabel={publicContext?.consentLabel || ''}
              privacyUrl={publicContext?.privacyUrl}
              mileageReviewRequired={
                pricingPreview.data?.mileage?.status === 'pending_review'
              }
              saving={saving}
              submitError={Boolean(saveErrorInfo)}
              onConsentChange={(accepted) =>
                updateState({
                  publicConsentAccepted: accepted,
                  publicConsentVersion:
                    publicContext?.consentVersion ?? null,
                })
              }
              onGoToStep={(nextStep) => {
                if (!canNavigateToStep(nextStep, stepStatusCtx)) return
                setNavigationIssues([])
                setStep(nextStep)
              }}
              onBack={goBack}
              onSubmit={() => void handleSaveQuote(false)}
            />
          ) : (
            <QuoteWizardConfirmationStep
              state={state}
              breakdown={pricingBreakdown}
              pricingLoading={pricingPreview.loading}
              pricingError={pricingPreview.error}
              customerName={
                isEditMode
                  ? editCustomerDisplayName
                  : selectedCustomer
                    ? getCustomerName(selectedCustomer)
                    : state.customerDraftName.trim() ||
                      w.customerNotLinkedShort
              }
              packageName={
                selectedPackage
                  ? getPackageName(selectedPackage, uiLocale)
                  : null
              }
              packageImageUrl={packageImageUrl}
              selectedPackage={selectedPackage}
              allPackages={packages}
              packageOptionGroups={flatOptionGroups}
              packageOptionGroupItems={flatOptionGroupItems}
              packageItems={packageItems}
              packageSideItems={packageSideItems}
              fromWithSidesSection={fromWithSidesSection}
              additionals={reviewAdditionals}
              stepStatusCtx={stepStatusCtx}
              mandatoryPendingSteps={mandatoryPendingSteps}
              quoteReady={quoteReady}
              saving={saving}
              saveErrorInfo={saveErrorInfo}
              isEditMode={isEditMode}
              quoteId={quoteId}
              uiLanguage={uiLocale}
              onGoToStep={(nextStep) => {
                if (!canNavigateToStep(nextStep, stepStatusCtx)) return
                setStep(nextStep)
              }}
              onBack={goBack}
              onSave={() => void handleSaveQuote(false)}
              onDistanceChange={(distance) => {
                distanceManualRef.current = true
                updateState({ distance })
              }}
            />
          )
        )}

        {step !== 5 && isPublicMode ? (
          // The action bar stays pinned at the bottom, so the content keeps a
          // reserve of its height (plus the iOS safe area) to never hide the
          // last package, category, item or price behind it.
          <div
            aria-hidden
            data-wizard-cta-spacer
            className="h-[calc(7rem+env(safe-area-inset-bottom))]"
          />
        ) : null}

        {step !== 5 ? (
          <QuoteWizardStepNav
            step={step}
            wizardStepCount={WIZARD_STEP_COUNT}
            language={uiLocale}
            packageId={state.packageId}
            packageStepMessage={packageStepMessage}
            packageStepNextDisabled={packageStepNextDisabled}
            additionalsStepNextDisabled={additionalsStepNextDisabled}
            additionalsReviewMessage={
              additionalsReviewPrompt && additionalsStepNextDisabled
                ? tw(uiLocale, 'additionalsReviewAllCategories')
                : null
            }
            grillStepPendingIssuesCount={grillStepPendingIssues.length}
            keepPackageNextVisible={isPublicMode}
            sticky={isPublicMode}
            onBack={goBack}
            onNext={goNext}
            onPackageNextBlockedClick={() => {
              if (!state.packageId) {
                setPackageStepMessage(w.selectPackageToContinue)
                return
              }
              setPackageSelectionAttempted(true)
            }}
            onAdditionalsNextBlockedClick={handleAdditionalsNextBlockedClick}
          />
        ) : null}
      </div>
    </main>
  )
}
