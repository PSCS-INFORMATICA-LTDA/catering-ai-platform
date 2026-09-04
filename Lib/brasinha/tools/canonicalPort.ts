import { WAITER_SERVICE_FEE, GRILL_RENTAL_FEE } from '@/Lib/cdlCommercialRules'
import { fetchCatalogItems } from '@/Lib/fetchCatalogItems'
import { fetchPackages, type PackageListItem } from '@/Lib/fetchPackages'
import { fetchQuoteList } from '@/Lib/fetchQuoteList'
import { pickLocalizedText } from '@/Lib/i18n/locales'
import { getPublicPackageSidesGroup } from '@/Lib/packageCatalogVisual'
import { loadPackageConfiguration } from '@/Lib/packageConfiguration'
import {
  getBlockedCatalogItemIds,
  getOptionGroupTitle,
  getOptionItemLabel,
  isCustomPackage,
  isRequiredOptionGroup,
  mergeOptionGroupsForPackage,
} from '@/Lib/packageOptionGroups'
import { resolvePublicQuoteTenantByCompanyId } from '@/Lib/publicQuote/bootstrap'
import {
  buildExtraAvailabilityByItemId,
  DISPOSABLE_KIT_ITEM_KEY,
  getNonChargeableExtraIds,
  getSelectedInPackageCatalogIds,
  getUniversalIncludedCatalogIds,
  getVisiblePublicExtraItems,
  isDisposableKitItem,
  isWaiterServiceItem,
  WAITER_SERVICE_ITEM_KEY,
} from '@/Lib/publicQuote/extrasEligibility'
import { GRILL_RENTAL_ITEM_KEY, isGrillRentalAdditional } from '@/Lib/publicQuote/grillRentalDisplay'
import { fetchSupabaseCommercialRules } from '@/Lib/supabaseCommercialRules'
import type { BrasinhaLanguage, BrasinhaToolTrace } from '../types'
import type {
  BrasinhaCatalogPort,
  CatalogHit,
  CompanyPublicProfile,
  ExtraAvailabilityView,
  PackageConfigurationView,
  PackageSummary,
  PublicRulesSnapshot,
  PublicServiceOptionsView,
  QuotePublicLookup,
} from './types'

function trace(
  tool: string,
  source: string,
  companyId: string,
  ids: Record<string, string | number | null> = {},
): BrasinhaToolTrace {
  return {
    tool,
    source,
    companyId,
    ids,
    timestamp: new Date().toISOString(),
  }
}

function packageLabel(pkg: PackageListItem, language: BrasinhaLanguage) {
  return (
    pickLocalizedText(
      { pt: pkg.label_pt, en: pkg.label_en, es: pkg.label_es },
      language,
    ) ||
    pkg.package_name ||
    pkg.package_key ||
    pkg.id
  )
}

function packageSummary(
  pkg: PackageListItem,
  language: BrasinhaLanguage,
): PackageSummary {
  const key = pkg.package_key?.trim() || null
  const custom = Boolean(key && /PERS/i.test(key))
  const rawPrice = Number(pkg.price_per_person)
  return {
    id: pkg.id,
    packageKey: key,
    label: packageLabel(pkg, language),
    pricePerPerson: Number.isFinite(rawPrice) ? rawPrice : null,
    currency: pkg.currency_code?.trim() || 'USD',
    description:
      pickLocalizedText(
        {
          pt: pkg.description_pt || pkg.description,
          en: pkg.description_en,
          es: pkg.description_es,
        },
        language,
      ) || null,
    custom,
  }
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function matchesPackage(pkg: PackageListItem, query: string) {
  const needle = normalize(query)
  if (!needle) return false
  const hay = [
    pkg.package_key,
    pkg.package_name,
    pkg.label_pt,
    pkg.label_en,
    pkg.label_es,
  ]
    .filter(Boolean)
    .map((value) => normalize(String(value)))
  return hay.some((value) => value.includes(needle) || needle.includes(value))
}

function catalogLabel(
  item: {
    label_pt?: string | null
    label_en?: string | null
    label_es?: string | null
    item_name?: string | null
    item_key?: string | null
    id: string
  },
  language: BrasinhaLanguage,
) {
  return (
    pickLocalizedText(
      { pt: item.label_pt, en: item.label_en, es: item.label_es },
      language,
    ) ||
    item.item_name ||
    item.item_key ||
    item.id
  )
}

function catalogHit(
  item: {
    id: string
    item_key?: string | null
    item_name?: string | null
    label_pt?: string | null
    label_en?: string | null
    label_es?: string | null
    category_pt?: string | null
    current_price?: number | null
    sale_price?: number | null
    price?: number | null
    currency_code?: string | null
  },
  language: BrasinhaLanguage,
): CatalogHit {
  const price = Number(item.current_price ?? item.sale_price ?? item.price)
  return {
    id: item.id,
    itemKey: item.item_key ?? null,
    label: catalogLabel(item, language),
    price: Number.isFinite(price) ? price : null,
    currency: item.currency_code?.trim() || 'USD',
    category: item.category_pt ?? null,
  }
}

function matchesItem(
  item: {
    item_key?: string | null
    item_name?: string | null
    label_pt?: string | null
    label_en?: string | null
    label_es?: string | null
  },
  query: string,
) {
  const needle = normalize(query)
  if (!needle) return false
  return [
    item.item_key,
    item.item_name,
    item.label_pt,
    item.label_en,
    item.label_es,
  ]
    .filter(Boolean)
    .some((value) => normalize(String(value)).includes(needle))
}

export function createCanonicalCatalogPort(): BrasinhaCatalogPort {
  return {
    async getCompanyPublicProfile(companyId, language) {
      const tenant = await resolvePublicQuoteTenantByCompanyId(companyId, language)
      const data: CompanyPublicProfile | null = tenant
        ? {
            id: tenant.company.id,
            slug: tenant.company.slug,
            name: tenant.company.trade_name?.trim() || tenant.company.company_name,
            currency:
              tenant.company.default_currency?.trim() ||
              tenant.company.currency_code?.trim() ||
              'USD',
            supportPhone: tenant.settings.support_phone,
          }
        : null
      return {
        data,
        trace: trace(
          'get_company_public_profile',
          'Lib/publicQuote/bootstrap.resolvePublicQuoteTenantByCompanyId',
          companyId,
          { companyId, slug: data?.slug ?? null },
        ),
      }
    },
    async getPackages(companyId, language) {
      const result = await fetchPackages({
        companyId,
        activeOnly: true,
        includeGlobal: false,
      })
      const data = (result.data ?? []).map((pkg) => packageSummary(pkg, language))
      return {
        data,
        trace: trace(
          'get_packages',
          'Lib/fetchPackages.fetchPackages',
          companyId,
          { count: data.length },
        ),
      }
    },
    async getPackageDetails(companyId, query, language) {
      const result = await fetchPackages({
        companyId,
        activeOnly: true,
        includeGlobal: false,
      })
      const match = (result.data ?? []).find((pkg) => matchesPackage(pkg, query))
      if (match) {
        await loadPackageConfiguration({
          packageIds: [match.id],
          companyId,
        })
      }
      return {
        data: match ? packageSummary(match, language) : null,
        trace: trace(
          'get_package_details',
          'Lib/fetchPackages.fetchPackages+Lib/packageConfiguration.loadPackageConfiguration',
          companyId,
          { query, packageId: match?.id ?? null, packageKey: match?.package_key ?? null },
        ),
      }
    },
    async getCatalogItem(companyId, query, language) {
      const result = await fetchCatalogItems({
        companyId,
        audience: 'customer',
        activeOnly: true,
      })
      const match = (result.data ?? []).find((item) => matchesItem(item, query))
      return {
        data: match ? catalogHit(match, language) : null,
        trace: trace(
          'get_catalog_item',
          'Lib/fetchCatalogItems.fetchCatalogItems',
          companyId,
          { query, itemId: match?.id ?? null, itemKey: match?.item_key ?? null },
        ),
      }
    },
    async searchCatalog(companyId, query, language) {
      const result = await fetchCatalogItems({
        companyId,
        audience: 'customer',
        activeOnly: true,
      })
      const data = (result.data ?? [])
        .filter((item) => matchesItem(item, query))
        .slice(0, 8)
        .map((item) => catalogHit(item, language))
      return {
        data,
        trace: trace(
          'search_catalog',
          'Lib/fetchCatalogItems.fetchCatalogItems',
          companyId,
          { query, count: data.length },
        ),
      }
    },
    async getPublicBusinessRules(companyId) {
      const rules = await fetchSupabaseCommercialRules(companyId)
      const data: PublicRulesSnapshot = {
        sidesPricePerPerson: rules.sidesPricePerPerson,
        waiterServiceFee: WAITER_SERVICE_FEE,
        grillRentalFee: GRILL_RENTAL_FEE,
        minOrderWeekday: rules.minOrderWeekday,
        minOrderWeekend: rules.minOrderWeekend,
        reservationPercentage: rules.reservationPercentage,
        serviceDurationHours: rules.serviceDurationHours,
        crewSetupLeadMinutes: rules.crewSetupLeadMinutes,
        source: rules.source,
      }
      return {
        data,
        trace: trace(
          'get_public_business_rules',
          `Lib/supabaseCommercialRules.fetchSupabaseCommercialRules+Lib/cdlCommercialRules(${rules.source})`,
          companyId,
          {
            sidesPricePerPerson: data.sidesPricePerPerson,
            waiterServiceFee: data.waiterServiceFee,
            grillRentalFee: data.grillRentalFee,
            serviceDurationHours: data.serviceDurationHours,
            crewSetupLeadMinutes: data.crewSetupLeadMinutes,
          },
        ),
      }
    },
    async getQuoteByPublicReference(companyId, reference) {
      const quoteNumber = reference.trim()
      if (!quoteNumber) {
        return {
          data: null,
          trace: trace(
            'get_quote_by_public_reference',
            'Lib/fetchQuoteList.fetchQuoteList',
            companyId,
            { reference: null },
          ),
        }
      }
      const page = await fetchQuoteList({ companyId, q: quoteNumber, limit: 5 })
      const match = (page.data ?? []).find(
        (row) => row.quote_number.trim().toUpperCase() === quoteNumber.toUpperCase(),
      )
      const data: QuotePublicLookup | null = match
        ? {
            quoteNumber: match.quote_number,
            status: match.quote_status,
            eventDate: match.event_date,
            total: match.quote_total,
          }
        : null
      return {
        data,
        trace: trace(
          'get_quote_by_public_reference',
          'Lib/fetchQuoteList.fetchQuoteList',
          companyId,
          { reference: quoteNumber, quoteId: match?.id ?? null },
        ),
      }
    },
    async getPackageConfiguration(companyId, query, language, selections = {}) {
      const result = await fetchPackages({
        companyId,
        activeOnly: true,
        includeGlobal: false,
      })
      const match = (result.data ?? []).find((pkg) => matchesPackage(pkg, query))
      if (!match) {
        return {
          data: null,
          trace: trace(
            'get_package_configuration',
            'Lib/packageConfiguration.loadPackageConfiguration',
            companyId,
            { query, packageId: null },
          ),
        }
      }
      const loaded = await loadPackageConfiguration({
        packageIds: [match.id],
        companyId,
      })
      const groups = mergeOptionGroupsForPackage(
        match.id,
        loaded.data.optionGroups,
        loaded.data.optionGroupItems,
      )
      const included = [
        ...loaded.data.packageItems.filter((item) => item.included !== false && !item.is_choice_placeholder),
        ...loaded.data.packageSideItems.filter((item) => item.included !== false),
      ]
      const data: PackageConfigurationView = {
        packageId: match.id,
        packageKey: match.package_key ?? null,
        packageName: packageLabel(match, language),
        includedItems: included.slice(0, 24).map((item) => ({
          id: item.additional_item_id ?? item.id,
          label: catalogLabel(item, language),
          itemKey: item.item_key ?? null,
        })),
        requiredOptionGroups: groups.map((group) => ({
          id: group.id,
          label: getOptionGroupTitle(group, language),
          required: isRequiredOptionGroup(group),
          minChoices: group.min_choices ?? null,
          maxChoices: group.max_choices ?? null,
          selectedItemId: selections[group.id] ?? null,
          choices: group.items.slice(0, 12).map((item) => ({
            id: item.id,
            label: getOptionItemLabel(item, language),
            catalogItemId: item.additional_item_id ?? null,
          })),
        })),
      }
      return {
        data,
        trace: trace(
          'get_package_configuration',
          'Lib/packageConfiguration.loadPackageConfiguration+Lib/packageOptionGroups',
          companyId,
          {
            query,
            packageId: match.id,
            requiredGroups: data.requiredOptionGroups.filter((group) => group.required).length,
          },
        ),
      }
    },
    async getAvailableAdditionalsForPackage(
      companyId,
      query,
      language,
      selections = {},
    ) {
      const result = await fetchPackages({
        companyId,
        activeOnly: true,
        includeGlobal: false,
      })
      const match = (result.data ?? []).find((pkg) => matchesPackage(pkg, query))
      if (!match) {
        return {
          data: null,
          trace: trace(
            'get_available_additionals_for_package',
            'Lib/publicQuote/extrasEligibility',
            companyId,
            { query, packageId: null },
          ),
        }
      }
      const [catalog, loaded] = await Promise.all([
        fetchCatalogItems({
          companyId,
          audience: 'customer',
          activeOnly: true,
          withCurrentPrices: true,
        }),
        loadPackageConfiguration({ packageIds: [match.id], companyId }),
      ])
      const items = catalog.data ?? []
      const custom = isCustomPackage(match)
      const blocked = getBlockedCatalogItemIds(
        match.id,
        loaded.data.optionGroups,
        custom,
        {
          packageItems: loaded.data.packageItems,
          packageSideItems: loaded.data.packageSideItems,
          groupItems: loaded.data.optionGroupItems,
          selectedPackageOptions: selections,
        },
      )
      const blockedWithout = getBlockedCatalogItemIds(
        match.id,
        loaded.data.optionGroups,
        custom,
        {
          packageItems: loaded.data.packageItems,
          packageSideItems: loaded.data.packageSideItems,
          groupItems: loaded.data.optionGroupItems,
          selectedPackageOptions: {},
        },
      )
      const universal = getUniversalIncludedCatalogIds(items, match)
      const nonChargeable = getNonChargeableExtraIds(blocked, universal)
      const selectedInPackage = getSelectedInPackageCatalogIds(blocked, blockedWithout)
      const visible = getVisiblePublicExtraItems(items, nonChargeable)
      const availability = buildExtraAvailabilityByItemId(
        items.map((item) => item.id),
        nonChargeable,
        selectedInPackage,
      )
      const byId = new Map(items.map((item) => [item.id, item]))
      const available = visible
        .filter((item) => availability[item.id] === 'AVAILABLE')
        .slice(0, 12)
        .map((item) => ({
          id: item.id,
          itemKey: item.item_key ?? null,
          label: catalogLabel(item, language),
          price: Number.isFinite(Number(item.current_price ?? item.sale_price ?? item.price))
            ? Number(item.current_price ?? item.sale_price ?? item.price)
            : null,
          currency: item.currency_code?.trim() || 'USD',
          category: item.category_pt ?? null,
          status: 'AVAILABLE' as const,
        }))
      const mapStatus = <T extends 'INCLUDED_IN_PACKAGE' | 'SELECTED_IN_PACKAGE'>(
        ids: string[],
        status: T,
      ) =>
        ids.slice(0, 12).flatMap((id) => {
          const item = byId.get(id)
          if (!item) return []
          return [
            {
              id,
              itemKey: item.item_key ?? null,
              label: catalogLabel(item, language),
              status,
            },
          ]
        })
      const data: ExtraAvailabilityView = {
        available,
        includedInPackage: mapStatus(
          nonChargeable.filter((id) => !selectedInPackage.includes(id)),
          'INCLUDED_IN_PACKAGE',
        ),
        selectedInPackage: mapStatus(selectedInPackage, 'SELECTED_IN_PACKAGE'),
      }
      return {
        data,
        trace: trace(
          'get_available_additionals_for_package',
          'Lib/publicQuote/extrasEligibility+Lib/packageConfiguration',
          companyId,
          {
            query,
            packageId: match.id,
            available: data.available.length,
            included: data.includedInPackage.length,
          },
        ),
      }
    },
    async getPublicServiceOptions(companyId, query, language) {
      const result = await fetchPackages({
        companyId,
        activeOnly: true,
        includeGlobal: false,
      })
      const match = (result.data ?? []).find((pkg) => matchesPackage(pkg, query)) ?? null
      const catalog = await fetchCatalogItems({
        companyId,
        audience: 'customer',
        activeOnly: true,
        withCurrentPrices: true,
      })
      const items = catalog.data ?? []
      const waiter = items.find((item) => isWaiterServiceItem(item))
      const kit = items.find((item) => isDisposableKitItem(item))
      const grill = items.find((item) => isGrillRentalAdditional(item))
      const withSides = match ? getPublicPackageSidesGroup(match) === 'with_sides' : false
      const waiterPrice = Number(waiter?.current_price ?? waiter?.sale_price ?? waiter?.price)
      const kitPrice = Number(kit?.current_price ?? kit?.sale_price ?? kit?.price)
      const grillPrice = Number(grill?.current_price ?? grill?.sale_price ?? grill?.price)
      const data: PublicServiceOptionsView = {
        waiter: waiter
          ? {
              id: waiter.id,
              itemKey: WAITER_SERVICE_ITEM_KEY,
              label: catalogLabel(waiter, language),
              price: Number.isFinite(waiterPrice) ? waiterPrice : WAITER_SERVICE_FEE,
              currency: waiter.currency_code?.trim() || 'USD',
            }
          : {
              id: null,
              itemKey: WAITER_SERVICE_ITEM_KEY,
              label: 'Waiter service',
              price: WAITER_SERVICE_FEE,
              currency: 'USD',
            },
        disposableKit: kit
          ? {
              id: kit.id,
              itemKey: DISPOSABLE_KIT_ITEM_KEY,
              label: catalogLabel(kit, language),
              price: Number.isFinite(kitPrice) ? kitPrice : null,
              currency: kit.currency_code?.trim() || 'USD',
              included: withSides,
              offerable: !withSides,
            }
          : {
              id: null,
              itemKey: DISPOSABLE_KIT_ITEM_KEY,
              label: 'Disposable kit',
              price: null,
              currency: 'USD',
              included: withSides,
              offerable: !withSides,
            },
        grillRental: {
          id: grill?.id ?? null,
          itemKey: GRILL_RENTAL_ITEM_KEY,
          label: grill ? catalogLabel(grill, language) : 'Grill rental',
          price: Number.isFinite(grillPrice) ? grillPrice : GRILL_RENTAL_FEE,
          currency: grill?.currency_code?.trim() || 'USD',
          qtyWhenRequired: 1,
        },
      }
      return {
        data,
        trace: trace(
          'get_public_service_options',
          'Lib/publicQuote/extrasEligibility+Lib/cdlCommercialRules',
          companyId,
          { query, packageId: match?.id ?? null, withSides: withSides ? 'yes' : 'no' },
        ),
      }
    },
  }
}
