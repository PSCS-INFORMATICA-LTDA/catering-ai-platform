import { DICTIONARY_ENTITIES } from './entities.ts'
import { fieldSemantics, toApiName } from './fieldSemantics.ts'
import type {
  DictionaryField,
  MergedDictionary,
  PhysicalColumn,
} from './types.ts'
import type { PhysicalTables } from './physicalSchema.ts'

function foreignEntityFromTable(
  table: string | null,
  entities: typeof DICTIONARY_ENTITIES,
): string | null {
  if (!table) return null
  const hit = entities.find((e) => e.db_table === table)
  return hit?.code ?? table
}

export function mergeDictionaryCatalog(
  physical: PhysicalTables,
  generatedAt = new Date().toISOString(),
): MergedDictionary {
  const fields: DictionaryField[] = []

  for (const entity of DICTIONARY_ENTITIES) {
    if (!entity.db_table || entity.active === false) continue
    const cols: PhysicalColumn[] = physical[entity.db_table] || []
    cols.forEach((col, index) => {
      const sem = fieldSemantics(entity.code, col.column)
      fields.push({
        entity_code: entity.code,
        code: `${entity.code}.${col.column}`,
        db_column: col.column,
        api_name: toApiName(col.column),
        display_name: col.column,
        description_pt: sem.description_pt ?? null,
        description_en: sem.description_en ?? null,
        description_es: sem.description_es ?? null,
        data_type: col.data_type,
        max_length: col.max_length,
        precision: col.precision,
        scale: col.scale,
        required: col.required,
        primary_key: col.primary_key,
        foreign_key: col.foreign_key,
        foreign_entity: foreignEntityFromTable(col.foreign_table, DICTIONARY_ENTITIES),
        sensitive: Boolean(sem.sensitive),
        financial: Boolean(sem.financial),
        translatable: Boolean(sem.translatable),
        display_order: (index + 1) * 10,
        integration_name: sem.integration_name || col.column,
        active: true,
        notes: sem.notes ?? null,
      })
    })
  }

  return {
    generated_at: generatedAt,
    source: 'platform_git + live_schema',
    entities: DICTIONARY_ENTITIES,
    fields,
  }
}

export function detectCatalogIssues(
  catalog: MergedDictionary,
  physical: PhysicalTables,
): {
  missingColumns: string[]
  duplicates: string[]
  displayOrderInvalid: string[]
} {
  const missingColumns: string[] = []
  const seen = new Map<string, number>()
  const duplicates: string[] = []

  for (const field of catalog.fields) {
    const count = (seen.get(field.code) || 0) + 1
    seen.set(field.code, count)
    if (count === 2) duplicates.push(field.code)

    const entity = catalog.entities.find((e) => e.code === field.entity_code)
    const table = entity?.db_table
    if (!table) {
      missingColumns.push(field.code)
      continue
    }
    const cols = physical[table] || []
    if (!cols.some((c) => c.column === field.db_column)) {
      missingColumns.push(field.code)
    }
  }

  const displayOrderInvalid: string[] = []
  const byEntity = new Map<string, number[]>()
  for (const field of catalog.fields) {
    const list = byEntity.get(field.entity_code) || []
    list.push(field.display_order)
    byEntity.set(field.entity_code, list)
  }
  for (const [entity, orders] of byEntity) {
    const uniq = new Set(orders)
    if (uniq.size !== orders.length) {
      displayOrderInvalid.push(entity)
    }
    if (orders.some((n) => !Number.isFinite(n) || n <= 0)) {
      displayOrderInvalid.push(entity)
    }
  }

  return { missingColumns, duplicates, displayOrderInvalid }
}
