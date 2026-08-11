export type DictionaryModule =
  | 'core'
  | 'cadastros'
  | 'comercial'
  | 'operacional'
  | 'inventory_future'

export type DictionaryEntity = {
  code: string
  module: DictionaryModule
  display_name: string
  description: string
  db_table: string | null
  api_resource: string | null
  active: boolean
  display_order: number
  notes: string | null
}

export type PhysicalColumn = {
  column: string
  data_type: string
  max_length: number | null
  precision: number | null
  scale: number | null
  required: boolean
  primary_key: boolean
  foreign_key: boolean
  foreign_table: string | null
  foreign_column: string | null
}

export type FieldSemantics = {
  description_pt?: string | null
  description_en?: string | null
  description_es?: string | null
  sensitive?: boolean
  financial?: boolean
  translatable?: boolean
  integration_name?: string | null
  notes?: string | null
}

export type DictionaryField = {
  entity_code: string
  code: string
  db_column: string
  api_name: string
  display_name: string
  description_pt: string | null
  description_en: string | null
  description_es: string | null
  data_type: string
  max_length: number | null
  precision: number | null
  scale: number | null
  required: boolean
  primary_key: boolean
  foreign_key: boolean
  foreign_entity: string | null
  sensitive: boolean
  financial: boolean
  translatable: boolean
  display_order: number
  integration_name: string
  active: boolean
  notes: string | null
}

export type MergedDictionary = {
  generated_at: string
  source: 'platform_git + live_schema'
  entities: DictionaryEntity[]
  fields: DictionaryField[]
}
