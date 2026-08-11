/**
 * QA T08–T14 — Translation registry + UI locale vs quote.language
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { CATERING_NAV } from '../../components/layout/navConfig.ts'
import {
  getChromeGroupLabel,
  getChromeNavLabel,
} from '../../Lib/i18n/chrome.ts'
import {
  buildTranslationRegistry,
  inspectTranslationRegistry,
} from '../../Lib/i18n/registry.ts'
import {
  formatUiDate,
  resolveDocumentLocale,
  resolveUiLocale,
} from '../../Lib/i18n/locales.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const rows = []
const record = (id, ok, detail) => {
  rows.push({ id, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail || ''}`)
}

const entries = buildTranslationRegistry()
const inspect = inspectTranslationRegistry(entries)

record('T08', inspect.missingPt.length === 0, `keys=${inspect.count} missingPt=${inspect.missingPt.length}`)
record('T09', inspect.missingEn.length === 0, `missingEn=${inspect.missingEn.slice(0, 5).join(',') || 0}`)
record('T10', inspect.missingEs.length === 0, `missingEs=${inspect.missingEs.slice(0, 5).join(',') || 0}`)

{
  const fake = [...entries, { ...entries[0] }]
  const dup = inspectTranslationRegistry(fake).duplicates
  record('T11', dup.length > 0, dup.length ? 'DETECTED' : 'missed')
}

{
  const fake = entries.map((e, i) => (i === 0 ? { ...e, en: '' } : e))
  const empty = inspectTranslationRegistry(fake).empty
  record('T12', empty.length > 0, empty.length ? 'DETECTED' : 'missed')
}

record(
  'T13',
  resolveUiLocale('pt') === 'pt' && resolveDocumentLocale('en') === 'en',
  `ui=${resolveUiLocale('pt')} quote=${resolveDocumentLocale('en')}`,
)
record(
  'T14',
  resolveUiLocale('en') === 'en' && resolveDocumentLocale('es') === 'es',
  `ui=${resolveUiLocale('en')} quote=${resolveDocumentLocale('es')}`,
)

{
  const missing = []
  for (const group of CATERING_NAV) {
    if (!getChromeGroupLabel('en', group.id, '')) missing.push(group.id)
    for (const child of group.children) {
      const label = getChromeNavLabel('en', child.href, '', child.soon)
      if (!label) missing.push(child.href || child.label)
    }
  }
  record('T15-chrome-nav', missing.length === 0, missing.join(',') || 'shell nav EN')
}

{
  const sample = formatUiDate('2027-12-18', 'en')
  record(
    'T15-date',
    /dec/i.test(sample) && !/dez/i.test(sample),
    sample,
  )
}

const wizard = readFileSync(join(ROOT, 'app/quotes/new/QuoteWizard.tsx'), 'utf8')
const pdf = readFileSync(join(ROOT, 'app/quotes/[id]/QuotePdfDocument.tsx'), 'utf8')
const wiredUi = wizard.includes('useAuthLocaleFromMe') && wizard.includes('documentLanguage')
const wiredPdf = pdf.includes('quote.language')
record('T13-wiring', wiredUi && wiredPdf, `wizardUi=${wiredUi} pdfDoc=${wiredPdf}`)

const failed = rows.filter((r) => !r.ok)
if (inspect.missingEn.length && inspect.missingEn.length <= 12) {
  console.log('missing EN', inspect.missingEn.join(', '))
}
if (inspect.missingEs.length && inspect.missingEs.length <= 12) {
  console.log('missing ES', inspect.missingEs.join(', '))
}
console.log(
  failed.length === 0
    ? 'I18N REGISTRY: PASS'
    : `I18N REGISTRY: FAIL — ${failed.map((f) => f.id).join(',')}`,
)
process.exit(failed.length === 0 ? 0 : 1)
