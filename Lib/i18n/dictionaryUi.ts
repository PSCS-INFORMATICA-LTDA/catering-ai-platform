import type { AuthLocale } from './authUsers.ts'
import { pickLocalizedText } from './locales.ts'

const dict = {
  pt: {
    navDataDictionary: 'Dicionário de dados',
    title: 'Dicionário de dados',
    subtitle:
      'Metadata de entidades e campos (PSCS). Somente leitura — não altera o schema.',
    tabFields: 'Campos',
    tabTranslations: 'Traduções',
    filterModule: 'Módulo',
    filterEntity: 'Entidade',
    filterField: 'Campo',
    filterSensitive: 'Sensível',
    filterFinancial: 'Financeiro',
    filterTranslatable: 'Traduzível',
    all: 'Todos',
    yes: 'Sim',
    no: 'Não',
    colEntity: 'Entidade',
    colTable: 'Tabela',
    colColumn: 'Coluna',
    colApi: 'API',
    colType: 'Tipo',
    colLength: 'Tam.',
    colRequired: 'Obrig.',
    colPk: 'PK',
    colFk: 'FK',
    colSensitive: 'Sens.',
    colFinancial: 'Fin.',
    colTranslatable: 'I18n',
    colKey: 'Chave',
    colModule: 'Módulo',
    colContext: 'Contexto',
    colPt: 'PT',
    colEn: 'EN',
    colEs: 'ES',
    empty: 'Nenhum registro com estes filtros.',
    forbidden: 'Sem permissão para ver o dicionário.',
    platformNote: 'Metadata de plataforma (Git). Não é dado de empresa.',
  },
  en: {
    navDataDictionary: 'Data dictionary',
    title: 'Data dictionary',
    subtitle:
      'Entity and field metadata (PSCS). Read-only — does not change the schema.',
    tabFields: 'Fields',
    tabTranslations: 'Translations',
    filterModule: 'Module',
    filterEntity: 'Entity',
    filterField: 'Field',
    filterSensitive: 'Sensitive',
    filterFinancial: 'Financial',
    filterTranslatable: 'Translatable',
    all: 'All',
    yes: 'Yes',
    no: 'No',
    colEntity: 'Entity',
    colTable: 'Table',
    colColumn: 'Column',
    colApi: 'API',
    colType: 'Type',
    colLength: 'Len.',
    colRequired: 'Req.',
    colPk: 'PK',
    colFk: 'FK',
    colSensitive: 'Sens.',
    colFinancial: 'Fin.',
    colTranslatable: 'I18n',
    colKey: 'Key',
    colModule: 'Module',
    colContext: 'Context',
    colPt: 'PT',
    colEn: 'EN',
    colEs: 'ES',
    empty: 'No rows for these filters.',
    forbidden: 'You do not have permission to view the dictionary.',
    platformNote: 'Platform metadata (Git). Not company data.',
  },
  es: {
    navDataDictionary: 'Diccionario de datos',
    title: 'Diccionario de datos',
    subtitle:
      'Metadata de entidades y campos (PSCS). Solo lectura — no altera el schema.',
    tabFields: 'Campos',
    tabTranslations: 'Traducciones',
    filterModule: 'Módulo',
    filterEntity: 'Entidad',
    filterField: 'Campo',
    filterSensitive: 'Sensible',
    filterFinancial: 'Financiero',
    filterTranslatable: 'Traducible',
    all: 'Todos',
    yes: 'Sí',
    no: 'No',
    colEntity: 'Entidad',
    colTable: 'Tabla',
    colColumn: 'Columna',
    colApi: 'API',
    colType: 'Tipo',
    colLength: 'Tam.',
    colRequired: 'Oblig.',
    colPk: 'PK',
    colFk: 'FK',
    colSensitive: 'Sens.',
    colFinancial: 'Fin.',
    colTranslatable: 'I18n',
    colKey: 'Clave',
    colModule: 'Módulo',
    colContext: 'Contexto',
    colPt: 'PT',
    colEn: 'EN',
    colEs: 'ES',
    empty: 'Ningún registro con estos filtros.',
    forbidden: 'Sin permiso para ver el diccionario.',
    platformNote: 'Metadata de plataforma (Git). No es dato de empresa.',
  },
} as const

export type DictionaryUiKey = keyof (typeof dict)['pt']

export function tDictionaryUi(
  locale: AuthLocale | string | null | undefined,
  key: DictionaryUiKey,
): string {
  return pickLocalizedText(
    { pt: dict.pt[key], en: dict.en[key], es: dict.es[key] },
    locale,
  )
}

export function listDictionaryUiI18nEntries(): Array<{
  key: string
  module: string
  context: string
  pt: string
  en: string
  es: string
}> {
  return (Object.keys(dict.pt) as DictionaryUiKey[]).map((key) => ({
    key: `dictionary.${key}`,
    module: 'dictionary',
    context: 'ui',
    pt: dict.pt[key],
    en: dict.en[key],
    es: dict.es[key],
  }))
}
