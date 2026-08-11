/**
 * Exporta metadata do Data Dictionary (CSV + JSON) para scripts/dev/reports/.
 * DEV only. Não inclui linhas de negócio.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { DICTIONARY_ENTITIES } from '../../Lib/dictionary/entities.ts'
import { fetchPhysicalSchema } from '../../Lib/dictionary/physicalSchema.ts'
import { mergeDictionaryCatalog } from '../../Lib/dictionary/mergeCatalog.ts'
import { dictionaryToCsv, dictionaryToJson } from '../../Lib/dictionary/csv.ts'

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

const tables = DICTIONARY_ENTITIES.map((e) => e.db_table).filter(Boolean)
const physical = await fetchPhysicalSchema({ url, serviceKey: service, tables })
const catalog = mergeDictionaryCatalog(physical)
const outDir = join(ROOT, 'scripts', 'dev', 'reports')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'data-dictionary.csv'), dictionaryToCsv(catalog))
writeFileSync(
  join(outDir, 'data-dictionary.json'),
  JSON.stringify(dictionaryToJson(catalog), null, 2),
)
console.log(
  `EXPORT DATA DICTIONARY: PASS entities=${catalog.entities.length} fields=${catalog.fields.length}`,
)
console.log('  scripts/dev/reports/data-dictionary.csv')
console.log('  scripts/dev/reports/data-dictionary.json')
