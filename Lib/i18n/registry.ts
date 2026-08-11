import { listAuthI18nEntries } from './authUsers.ts'
import { listAgendaI18nEntries } from './agenda.ts'
import { listChromeI18nEntries } from './chrome.ts'
import { listCommercialRulesI18nEntries } from './commercialRules.ts'
import { listCommonI18nEntries } from './common.ts'
import { listCompanySettingsI18nEntries } from './companySettings.ts'
import { listCustomersI18nEntries } from './customers.ts'
import { listDictionaryUiI18nEntries } from './dictionaryUi.ts'
import { listHelpI18nEntries } from './help.ts'
import { listInventoryUiI18nEntries } from './inventoryUi.ts'
import { listPackagesI18nEntries } from './packages.ts'
import { listPublicOpsI18nEntries } from './publicOps.ts'
import { listQuotesOrdersI18nEntries } from './quotesOrders.ts'
import { listShareI18nEntries } from './share.ts'
import { listTeamsI18nEntries } from './teams.ts'
import { pickLocalizedText } from './locales.ts'
import { listQuoteWizardI18nEntries } from '../quoteTranslations.ts'

export type TranslationRegistryEntry = {
  key: string
  module: string
  context: string
  pt: string
  en: string
  es: string
  max_length: number | null
  display_order: number
  description: string
}

export function buildTranslationRegistry(): TranslationRegistryEntry[] {
  const rows = [
    ...listAuthI18nEntries(),
    ...listChromeI18nEntries(),
    ...listCommonI18nEntries(),
    ...listCustomersI18nEntries(),
    ...listTeamsI18nEntries(),
    ...listAgendaI18nEntries(),
    ...listPackagesI18nEntries(),
    ...listCommercialRulesI18nEntries(),
    ...listInventoryUiI18nEntries(),
    ...listCompanySettingsI18nEntries(),
    ...listHelpI18nEntries(),
    ...listShareI18nEntries(),
    ...listPublicOpsI18nEntries(),
    ...listQuotesOrdersI18nEntries(),
    ...listQuoteWizardI18nEntries(),
    ...listDictionaryUiI18nEntries(),
  ]
  return rows.map((row, index) => ({
    ...row,
    max_length: null,
    display_order: (index + 1) * 10,
    description: `${row.module} / ${row.context}`,
  }))
}

export function inspectTranslationRegistry(entries = buildTranslationRegistry()) {
  const seen = new Map<string, number>()
  const duplicates: string[] = []
  const missingPt: string[] = []
  const missingEn: string[] = []
  const missingEs: string[] = []
  const empty: string[] = []

  for (const row of entries) {
    const n = (seen.get(row.key) || 0) + 1
    seen.set(row.key, n)
    if (n === 2) duplicates.push(row.key)
    if (!row.pt?.trim()) missingPt.push(row.key)
    if (!row.en?.trim()) missingEn.push(row.key)
    if (!row.es?.trim()) missingEs.push(row.key)
    if (!row.pt?.trim() || !row.en?.trim() || !row.es?.trim()) {
      empty.push(row.key)
    }
  }

  return { duplicates, missingPt, missingEn, missingEs, empty, count: entries.length }
}

export function resolveRegistryText(
  key: string,
  locale: string | null | undefined,
  entries = buildTranslationRegistry(),
): string {
  const row = entries.find((e) => e.key === key)
  if (!row) return ''
  return pickLocalizedText(row, locale)
}
