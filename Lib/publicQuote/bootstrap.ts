import 'server-only'

import { fetchCatalogItems } from '@/Lib/fetchCatalogItems'
import { fetchPackages } from '@/Lib/fetchPackages'
import { loadPackageConfiguration } from '@/Lib/packageConfiguration'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { fetchSupabaseCommercialRules } from '@/Lib/supabaseCommercialRules'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import {
  normalizePublicCompanySlug,
  parsePublicQuoteLocale,
} from './security'
import type { PublicQuoteBootstrap } from './types'

export type PublicQuoteCompanyRow = {
  id: string
  company_name: string
  trade_name?: string | null
  slug: string
  default_language?: string | null
  currency_code?: string | null
  default_currency?: string | null
  logo_url?: string | null
  brand_logo_url?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  active?: boolean | null
}

export type PublicQuoteSettingsRow = {
  company_id: string
  enabled: boolean
  allowed_languages: string[]
  allowed_countries: string[]
  hero_image_url: string | null
  landing_copy: Record<string, unknown>
  consent_copy: Record<string, unknown>
  consent_version: string
  privacy_url: string | null
  support_phone: string | null
  support_whatsapp_url: string | null
  primary_color: string | null
  accent_color: string | null
}

export type ResolvedPublicQuoteTenant = {
  company: PublicQuoteCompanyRow
  settings: PublicQuoteSettingsRow
  locale: QuoteLanguage
  allowedLocales: QuoteLanguage[]
}

async function loadEnabledSettings(companyId: string) {
  const supabase = getSupabaseServerClient()
  const [{ data: settingsData, error: settingsError }, featureResult] =
    await Promise.all([
      supabase
        .from('company_public_quote_settings')
        .select(
          'company_id, enabled, allowed_languages, allowed_countries, hero_image_url, landing_copy, consent_copy, consent_version, privacy_url, support_phone, support_whatsapp_url, primary_color, accent_color',
        )
        .eq('company_id', companyId)
        .eq('enabled', true)
        .maybeSingle(),
      supabase
        .from('company_features')
        .select('company_id, feature_key, enabled')
        .eq('company_id', companyId)
        .eq('feature_key', 'public_self_service_quote')
        .eq('enabled', true)
        .maybeSingle(),
    ])

  if (
    settingsError ||
    !settingsData ||
    featureResult.error ||
    !featureResult.data
  ) {
    console.error('[public-quote] enabled settings unavailable', {
      settingsError: Boolean(settingsError),
      settingsFound: Boolean(settingsData),
      featureError: Boolean(featureResult.error),
      featureFound: Boolean(featureResult.data),
    })
    return null
  }
  return settingsData as PublicQuoteSettingsRow
}

function allowedLocalesForSettings(settings: PublicQuoteSettingsRow) {
  return (settings.allowed_languages ?? [])
    .map(parsePublicQuoteLocale)
    .filter((value): value is QuoteLanguage => Boolean(value))
}

async function resolveTenantFromCompany(
  companyData: unknown,
  localeValue: string,
): Promise<ResolvedPublicQuoteTenant | null> {
  if (!companyData) return null
  const locale = parsePublicQuoteLocale(localeValue)
  if (!locale) return null
  const company = companyData as PublicQuoteCompanyRow
  const settings = await loadEnabledSettings(company.id)
  if (!settings) return null
  const allowedLocales = allowedLocalesForSettings(settings)
  if (!allowedLocales.includes(locale)) return null
  return { company, settings, locale, allowedLocales }
}

export async function resolvePublicQuoteTenant(
  companySlugValue: string,
  localeValue: string,
): Promise<ResolvedPublicQuoteTenant | null> {
  const companySlug = normalizePublicCompanySlug(companySlugValue)
  if (!companySlug) return null
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('companies')
    .select(
      'id, company_name, trade_name, slug, default_language, currency_code, default_currency, logo_url, brand_logo_url, primary_color, secondary_color, active',
    )
    .eq('slug', companySlug)
    .eq('active', true)
    .maybeSingle()
  if (error || !data) {
    console.error('[public-quote] company slug lookup failed', {
      hasError: Boolean(error),
      found: Boolean(data),
    })
    return null
  }
  return resolveTenantFromCompany(data, localeValue)
}

export async function resolvePublicQuoteTenantByCompanyId(
  companyId: string,
  localeValue: string,
): Promise<ResolvedPublicQuoteTenant | null> {
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) return null
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('companies')
    .select(
      'id, company_name, trade_name, slug, default_language, currency_code, default_currency, logo_url, brand_logo_url, primary_color, secondary_color, active',
    )
    .eq('id', companyId)
    .eq('active', true)
    .maybeSingle()
  if (error) return null
  return resolveTenantFromCompany(data, localeValue)
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim()
    : fallback
}

function safePublicUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const candidate = value.trim()
  if (candidate.startsWith('/')) return candidate
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function localizedObject(
  value: Record<string, unknown> | null | undefined,
  locale: QuoteLanguage,
): Record<string, unknown> {
  const selected = value?.[locale]
  if (selected && typeof selected === 'object' && !Array.isArray(selected)) {
    return selected as Record<string, unknown>
  }
  const fallback = value?.pt
  return fallback && typeof fallback === 'object' && !Array.isArray(fallback)
    ? (fallback as Record<string, unknown>)
    : {}
}

function localizedText(
  value: Record<string, unknown> | null | undefined,
  locale: QuoteLanguage,
  fallback: string,
): string {
  const selected = value?.[locale]
  if (typeof selected === 'string' && selected.trim()) return selected.trim()
  const pt = value?.pt
  return typeof pt === 'string' && pt.trim() ? pt.trim() : fallback
}

function textField(
  object: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = object[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function sanitizePackage(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    package_key: typeof row.package_key === 'string' ? row.package_key : null,
    package_name:
      typeof row.package_name === 'string' ? row.package_name : null,
    label_pt: typeof row.label_pt === 'string' ? row.label_pt : null,
    label_en: typeof row.label_en === 'string' ? row.label_en : null,
    label_es: typeof row.label_es === 'string' ? row.label_es : null,
    description:
      typeof row.description === 'string' ? row.description : null,
    description_pt:
      typeof row.description_pt === 'string' ? row.description_pt : null,
    description_en:
      typeof row.description_en === 'string' ? row.description_en : null,
    description_es:
      typeof row.description_es === 'string' ? row.description_es : null,
    price_per_person: Number(row.price_per_person ?? 0),
    currency_code:
      typeof row.currency_code === 'string' ? row.currency_code : null,
    display_order: Number(row.display_order ?? 0),
    image_url: safePublicUrl(row.image_url),
    package_highlights_pt:
      typeof row.package_highlights_pt === 'string'
        ? row.package_highlights_pt
        : null,
    package_highlights_en:
      typeof row.package_highlights_en === 'string'
        ? row.package_highlights_en
        : null,
    package_highlights_es:
      typeof row.package_highlights_es === 'string'
        ? row.package_highlights_es
        : null,
    card_theme_key:
      typeof row.card_theme_key === 'string' ? row.card_theme_key : 'slate',
    active: true,
  }
}

function sanitizeCatalogItem(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    item_key: typeof row.item_key === 'string' ? row.item_key : null,
    item_name: typeof row.item_name === 'string' ? row.item_name : null,
    label_pt: typeof row.label_pt === 'string' ? row.label_pt : null,
    label_en: typeof row.label_en === 'string' ? row.label_en : null,
    label_es: typeof row.label_es === 'string' ? row.label_es : null,
    category_key:
      typeof row.category_key === 'string' ? row.category_key : null,
    category_pt:
      typeof row.category_pt === 'string' ? row.category_pt : null,
    category_en:
      typeof row.category_en === 'string' ? row.category_en : null,
    category_es:
      typeof row.category_es === 'string' ? row.category_es : null,
    sale_price: Number(row.current_price ?? row.sale_price ?? row.price ?? 0),
    current_price: Number(
      row.current_price ?? row.sale_price ?? row.price ?? 0,
    ),
    charge_type:
      typeof row.charge_type === 'string' ? row.charge_type : null,
    pricing_type:
      typeof row.pricing_type === 'string' ? row.pricing_type : null,
    unit_label:
      typeof row.unit_label === 'string' ? row.unit_label : null,
    currency_code:
      typeof row.currency_code === 'string' ? row.currency_code : null,
    display_order: Number(row.display_order ?? 0),
    image_url: safePublicUrl(row.image_url),
    item_type: typeof row.item_type === 'string' ? row.item_type : null,
    active: true,
    customer_visible: true,
  }
}

function sanitizePackageItem(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    package_id: String(row.package_id),
    additional_item_id:
      typeof row.additional_item_id === 'string'
        ? row.additional_item_id
        : null,
    item_key: typeof row.item_key === 'string' ? row.item_key : '',
    item_name: typeof row.item_name === 'string' ? row.item_name : null,
    label_pt: typeof row.label_pt === 'string' ? row.label_pt : '',
    label_en: typeof row.label_en === 'string' ? row.label_en : null,
    label_es: typeof row.label_es === 'string' ? row.label_es : null,
    description_pt:
      typeof row.description_pt === 'string' ? row.description_pt : null,
    description_en:
      typeof row.description_en === 'string' ? row.description_en : null,
    description_es:
      typeof row.description_es === 'string' ? row.description_es : null,
    quantity: Number(row.quantity ?? 0),
    unit_label_pt:
      typeof row.unit_label_pt === 'string' ? row.unit_label_pt : null,
    unit_label_en:
      typeof row.unit_label_en === 'string' ? row.unit_label_en : null,
    unit_label_es:
      typeof row.unit_label_es === 'string' ? row.unit_label_es : null,
    included: row.included !== false,
    is_choice_placeholder: row.is_choice_placeholder === true,
    blocks_additional_item: row.blocks_additional_item === true,
    display_order: Number(row.display_order ?? 0),
    active: true,
  }
}

function sanitizeOptionGroup(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    package_id: String(row.package_id),
    option_group_key:
      typeof row.option_group_key === 'string' ? row.option_group_key : '',
    group_key: typeof row.group_key === 'string' ? row.group_key : null,
    label_pt: typeof row.label_pt === 'string' ? row.label_pt : null,
    label_en: typeof row.label_en === 'string' ? row.label_en : null,
    label_es: typeof row.label_es === 'string' ? row.label_es : null,
    min_choices: Number(row.min_choices ?? 1),
    max_choices: Number(row.max_choices ?? 1),
    required: row.required !== false,
    blocks_additional_items: row.blocks_additional_items !== false,
    display_order: Number(row.display_order ?? 0),
    active: true,
  }
}

function sanitizeOptionItem(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    option_group_id: String(row.option_group_id),
    additional_item_id:
      typeof row.additional_item_id === 'string'
        ? row.additional_item_id
        : null,
    option_item_key:
      typeof row.option_item_key === 'string' ? row.option_item_key : null,
    label_pt: typeof row.label_pt === 'string' ? row.label_pt : null,
    label_en: typeof row.label_en === 'string' ? row.label_en : null,
    label_es: typeof row.label_es === 'string' ? row.label_es : null,
    display_order: Number(row.display_order ?? 0),
    active: true,
  }
}

export async function getPublicQuoteBootstrap(
  companySlugValue: string,
  localeValue: string,
): Promise<PublicQuoteBootstrap | null> {
  const tenant = await resolvePublicQuoteTenant(companySlugValue, localeValue)
  if (!tenant) return null
  const { company, settings, locale, allowedLocales } = tenant
  const supabase = getSupabaseServerClient()

  const { data: branchData, error: branchError } = await supabase
    .from('branches')
    .select('id, name, is_default, country')
    .eq('company_id', company.id)
    .eq('active', true)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
  if (branchError) return null

  const packagesResult = await fetchPackages({
    activeOnly: true,
    companyId: company.id,
    includeGlobal: false,
  })
  if (packagesResult.error) return null
  const packages = packagesResult.data ?? []
  if (packages.length === 0) return null

  const [catalogResult, configurationResult, commercialRules] =
    await Promise.all([
      fetchCatalogItems({
        activeOnly: true,
        usage: 'additional',
        audience: 'customer',
        companyId: company.id,
        branchId:
          (branchData ?? []).find((row) => row.is_default)?.id ?? null,
      }),
      loadPackageConfiguration({
        packageIds: packages.map((pkg) => pkg.id),
        companyId: company.id,
      }),
      fetchSupabaseCommercialRules(company.id),
    ])
  if (catalogResult.error || configurationResult.error) return null

  const landing = localizedObject(settings.landing_copy, locale)
  const displayName =
    company.trade_name?.trim() || company.company_name.trim()
  const defaultLocale =
    parsePublicQuoteLocale(company.default_language) ?? allowedLocales[0] ?? 'pt'
  const currencyCode =
    company.default_currency?.trim() ||
    company.currency_code?.trim() ||
    'USD'

  return {
    company: {
      id: company.id,
      slug: company.slug,
      name: displayName,
      logoUrl: safePublicUrl(company.brand_logo_url || company.logo_url),
      primaryColor: safeColor(
        settings.primary_color || company.primary_color,
        '#991b1b',
      ),
      accentColor: safeColor(
        settings.accent_color || company.secondary_color,
        '#d4a017',
      ),
      currencyCode,
    },
    settings: {
      enabled: true,
      defaultLocale,
      allowedLocales,
      allowedCountries: (settings.allowed_countries ?? [])
        .map((country) => country.trim().toUpperCase())
        .filter((country) => /^[A-Z]{2}$/.test(country)),
      heroImageUrl: safePublicUrl(settings.hero_image_url),
      landing: {
        eyebrow: textField(landing, 'eyebrow', 'Catering made for you'),
        title: textField(landing, 'title', 'Plan your event with confidence'),
        subtitle: textField(
          landing,
          'subtitle',
          'Build a personalized catering estimate in a few guided steps.',
        ),
        intro: textField(
          landing,
          'intro',
          'Tell us about your event and our team will review every detail.',
        ),
        cta: textField(landing, 'cta', 'Start my quote'),
      },
      consent: {
        version: settings.consent_version,
        label: localizedText(
          settings.consent_copy,
          locale,
          'I agree to be contacted about this event request.',
        ),
        privacyUrl: safePublicUrl(settings.privacy_url),
      },
      support: {
        phone: settings.support_phone?.trim() || null,
        whatsappUrl: safePublicUrl(settings.support_whatsapp_url),
      },
    },
    branches: (branchData ?? []).map((branch) => ({
      id: String(branch.id),
      name: String(branch.name),
      isDefault: branch.is_default === true,
      country: typeof branch.country === 'string' ? branch.country : null,
    })),
    packages: packages.map((row) =>
      sanitizePackage(row as unknown as Record<string, unknown>),
    ),
    catalogItems: (catalogResult.data ?? []).map((row) =>
      sanitizeCatalogItem(row as unknown as Record<string, unknown>),
    ),
    packageItems: (configurationResult.data?.packageItems ?? []).map((row) =>
      sanitizePackageItem(row as unknown as Record<string, unknown>),
    ),
    packageSideItems: (
      configurationResult.data?.packageSideItems ?? []
    ).map((row) =>
      sanitizePackageItem(row as unknown as Record<string, unknown>),
    ),
    optionGroups: (configurationResult.data?.optionGroups ?? []).map((row) =>
      sanitizeOptionGroup(row as unknown as Record<string, unknown>),
    ),
    optionGroupItems: (
      configurationResult.data?.optionGroupItems ?? []
    ).map((row) =>
      sanitizeOptionItem(row as unknown as Record<string, unknown>),
    ),
    commercialRules,
  }
}
