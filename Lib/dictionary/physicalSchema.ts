import type { PhysicalColumn } from './types.ts'

export type PhysicalTables = Record<string, PhysicalColumn[]>

type OpenApiProperty = {
  type?: string
  format?: string
  maxLength?: number
  description?: string | null
}

type OpenApiDefinition = {
  required?: string[]
  properties?: Record<string, OpenApiProperty>
}

function parseFk(description: string | null | undefined): {
  table: string | null
  column: string | null
} {
  if (!description) return { table: null, column: null }
  const m = description.match(/<fk table='([^']+)' column='([^']+)'\/>/)
  if (!m) return { table: null, column: null }
  return { table: m[1], column: m[2] }
}

function isPk(description: string | null | undefined): boolean {
  return Boolean(description && description.includes('<pk/>'))
}

function mapType(prop: OpenApiProperty): string {
  if (prop.format && prop.format !== 'uuid') {
    if (prop.type === 'string' && prop.format === 'timestamp with time zone') {
      return prop.format
    }
    if (
      prop.format === 'timestamp without time zone' ||
      prop.format === 'timestamp with time zone' ||
      prop.format === 'date' ||
      prop.format === 'time without time zone' ||
      prop.format === 'jsonb' ||
      prop.format === 'numeric' ||
      prop.format === 'integer' ||
      prop.format === 'bigint' ||
      prop.format === 'boolean' ||
      prop.format === 'uuid' ||
      prop.format === 'character varying' ||
      prop.format === 'text' ||
      prop.format === 'ARRAY'
    ) {
      return prop.format
    }
  }
  if (prop.format === 'uuid') return 'uuid'
  return prop.format || prop.type || 'unknown'
}

export function parseOpenApiToPhysical(
  spec: Record<string, unknown>,
  tables: string[],
): PhysicalTables {
  const defs = (spec.definitions ||
    (spec.components as { schemas?: Record<string, OpenApiDefinition> } | undefined)
      ?.schemas ||
    {}) as Record<string, OpenApiDefinition>

  const out: PhysicalTables = {}
  for (const table of tables) {
    const def = defs[table]
    if (!def?.properties) {
      out[table] = []
      continue
    }
    const required = new Set(def.required || [])
    out[table] = Object.entries(def.properties).map(([column, prop]) => {
      const fk = parseFk(prop.description)
      const dataType = mapType(prop)
      return {
        column,
        data_type: dataType,
        max_length:
          typeof prop.maxLength === 'number' ? prop.maxLength : null,
        precision: null,
        scale: null,
        required: required.has(column),
        primary_key: isPk(prop.description),
        foreign_key: Boolean(fk.table),
        foreign_table: fk.table,
        foreign_column: fk.column,
      }
    })
  }
  return out
}

export async function fetchPhysicalSchema(input: {
  url: string
  serviceKey: string
  tables: string[]
}): Promise<PhysicalTables> {
  const res = await fetch(`${input.url.replace(/\/$/, '')}/rest/v1/`, {
    headers: {
      apikey: input.serviceKey,
      Authorization: `Bearer ${input.serviceKey}`,
      Accept: 'application/openapi+json',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`OpenAPI schema HTTP ${res.status}`)
  }
  const spec = (await res.json()) as Record<string, unknown>
  return parseOpenApiToPhysical(spec, input.tables)
}
