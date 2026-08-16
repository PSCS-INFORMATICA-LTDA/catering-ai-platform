import type { MergedDictionary } from './types.ts'

const CSV_HEADERS = [
  'Module',
  'EntityCode',
  'EntityName',
  'Table',
  'FieldCode',
  'Column',
  'APIName',
  'DescriptionPT',
  'DescriptionEN',
  'DescriptionES',
  'DataType',
  'MaxLength',
  'Precision',
  'Scale',
  'Required',
  'PK',
  'FK',
  'FKEntity',
  'Sensitive',
  'Financial',
  'Translatable',
  'DisplayOrder',
  'IntegrationName',
  'Notes',
] as const

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function boolCell(v: boolean): string {
  return v ? 'Y' : 'N'
}

export function dictionaryToCsv(catalog: MergedDictionary): string {
  const entityByCode = Object.fromEntries(
    catalog.entities.map((e) => [e.code, e]),
  )
  const lines = [CSV_HEADERS.join(',')]
  for (const field of catalog.fields) {
    const entity = entityByCode[field.entity_code]
    lines.push(
      [
        entity?.module ?? '',
        field.entity_code,
        entity?.display_name ?? '',
        entity?.db_table ?? '',
        field.code,
        field.db_column,
        field.api_name,
        field.description_pt ?? '',
        field.description_en ?? '',
        field.description_es ?? '',
        field.data_type,
        field.max_length ?? '',
        field.precision ?? '',
        field.scale ?? '',
        boolCell(field.required),
        boolCell(field.primary_key),
        boolCell(field.foreign_key),
        field.foreign_entity ?? '',
        boolCell(field.sensitive),
        boolCell(field.financial),
        boolCell(field.translatable),
        field.display_order,
        field.integration_name,
        field.notes ?? '',
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return `${lines.join('\r\n')}\r\n`
}

export function dictionaryToJson(catalog: MergedDictionary) {
  return {
    generated_at: catalog.generated_at,
    source: catalog.source,
    note: 'Metadata only. No business row data.',
    entities: catalog.entities.map((entity) => ({
      entity: entity.code,
      module: entity.module,
      display_name: entity.display_name,
      description: entity.description,
      table: entity.db_table,
      api_resource: entity.api_resource,
      active: entity.active,
      display_order: entity.display_order,
      notes: entity.notes,
      fields: catalog.fields
        .filter((f) => f.entity_code === entity.code)
        .map((f) => ({
          code: f.code,
          column: f.db_column,
          api_name: f.api_name,
          data_type: f.data_type,
          max_length: f.max_length,
          precision: f.precision,
          scale: f.scale,
          required: f.required,
          primary_key: f.primary_key,
          foreign_key: f.foreign_key,
          foreign_entity: f.foreign_entity,
          sensitive: f.sensitive,
          financial: f.financial,
          translatable: f.translatable,
          display_order: f.display_order,
          integration_name: f.integration_name,
          description: {
            pt: f.description_pt,
            en: f.description_en,
            es: f.description_es,
          },
          notes: f.notes,
        })),
    })),
  }
}
