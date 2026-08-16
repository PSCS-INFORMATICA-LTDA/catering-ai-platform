import type { AuthLocale } from './authUsers.ts'
import { pickLocalizedText } from './locales.ts'

export type LocaleTriple = { pt: string; en: string; es: string }

export function fillTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] == null ? '' : String(vars[key]),
  )
}

export function makeI18nModule<const T extends Record<string, LocaleTriple>>(
  module: string,
  context: string,
  entries: T,
) {
  type Key = keyof T & string

  function t(
    locale: AuthLocale | string | null | undefined,
    key: Key,
    vars?: Record<string, string | number>,
  ): string {
    const text = pickLocalizedText(entries[key], locale)
    return vars ? fillTemplate(text, vars) : text
  }

  function list() {
    return (Object.keys(entries) as Key[]).map((key) => ({
      key: `${module}.${key}`,
      module,
      context,
      pt: entries[key].pt,
      en: entries[key].en,
      es: entries[key].es,
    }))
  }

  return { t, list, entries }
}
