/**
 * QA T01–T07 — Data Dictionary (DEV). Schema real via OpenAPI.
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { DICTIONARY_ENTITIES } from '../../Lib/dictionary/entities.ts'
import { fetchPhysicalSchema } from '../../Lib/dictionary/physicalSchema.ts'
import {
  detectCatalogIssues,
  mergeDictionaryCatalog,
} from '../../Lib/dictionary/mergeCatalog.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const get = (k) => ((env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1] || '').trim()
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const service = get('SUPABASE_SERVICE_ROLE_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV) {
  console.error('BLOQUEADO — Project Ref não é DEV')
  process.exit(2)
}

const rows = []
const record = (id, ok, detail) => {
  rows.push({ id, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail || ''}`)
}

const requiredCodes = [
  'COMPANY',
  'USER',
  'MEMBERSHIP',
  'CUSTOMER',
  'CATALOG_ITEM',
  'PACKAGE',
  'QUOTE',
  'QUOTE_ADDITIONAL_ITEM',
  'QUOTE_VERSION',
  'SERVICE_ORDER',
  'SERVICE_ORDER_ITEM',
  'EVENT',
  'TEAM',
  'SERVICE_ORDER_MATERIAL',
]

const tables = DICTIONARY_ENTITIES.map((e) => e.db_table).filter(Boolean)
const physical = await fetchPhysicalSchema({ url, serviceKey: service, tables })
const catalog = mergeDictionaryCatalog(physical)
const issues = detectCatalogIssues(catalog, physical)

record(
  'T01',
  requiredCodes.every((c) => catalog.entities.some((e) => e.code === c)),
  `entities=${catalog.entities.length}`,
)

record(
  'T02',
  issues.missingColumns.length === 0 && catalog.fields.length > 0,
  `fields=${catalog.fields.length} missing=${issues.missingColumns.length}`,
)

{
  const fake = {
    ...catalog,
    fields: [
      ...catalog.fields,
      {
        ...catalog.fields[0],
        code: 'QUOTE.does_not_exist',
        db_column: 'does_not_exist_column_xyz',
        entity_code: 'QUOTE',
      },
    ],
  }
  const detected = detectCatalogIssues(fake, physical).missingColumns.includes(
    'QUOTE.does_not_exist',
  )
  record('T03', detected, detected ? 'DETECTED' : 'missed')
}

{
  const fake = {
    ...catalog,
    fields: [catalog.fields[0], { ...catalog.fields[0] }],
  }
  const detected = detectCatalogIssues(fake, physical).duplicates.length > 0
  record('T04', detected, detected ? 'DETECTED' : 'missed')
}

record(
  'T05',
  issues.displayOrderInvalid.length === 0,
  issues.displayOrderInvalid.join(',') || 'ok',
)

const financialCols = catalog.fields.filter((f) => f.financial).map((f) => f.db_column)
record(
  'T06',
  financialCols.includes('quote_total') &&
    financialCols.includes('package_price_per_person') &&
    financialCols.includes('cost_price'),
  `financial=${financialCols.length}`,
)

const sensitiveCols = catalog.fields.filter((f) => f.sensitive).map((f) => f.db_column)
record(
  'T07',
  sensitiveCols.includes('email') &&
    sensitiveCols.includes('phone') &&
    (sensitiveCols.includes('document') || sensitiveCols.includes('tax_id')),
  `sensitive=${sensitiveCols.length}`,
)

const failed = rows.filter((r) => !r.ok)
console.log(
  failed.length === 0
    ? 'DATA DICTIONARY: PASS'
    : `DATA DICTIONARY: FAIL — ${failed.map((f) => f.id).join(',')}`,
)
process.exit(failed.length === 0 ? 0 : 1)
