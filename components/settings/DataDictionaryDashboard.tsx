'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import BackofficeTableShell from '@/components/BackofficeTableShell'
import { tDictionaryUi } from '@/Lib/i18n/dictionaryUi'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { DictionaryField, DictionaryEntity } from '@/Lib/dictionary/types'
import type { TranslationRegistryEntry } from '@/Lib/i18n/registry'

type Tab = 'fields' | 'translations'
type Tri = 'all' | 'yes' | 'no'

export default function DataDictionaryDashboard() {
  const locale = useAuthLocaleFromMe()
  const t = (key: Parameters<typeof tDictionaryUi>[1]) =>
    tDictionaryUi(locale, key)

  const [tab, setTab] = useState<Tab>('fields')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entities, setEntities] = useState<DictionaryEntity[]>([])
  const [fields, setFields] = useState<DictionaryField[]>([])
  const [translations, setTranslations] = useState<TranslationRegistryEntry[]>(
    [],
  )

  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [sensitive, setSensitive] = useState<Tri>('all')
  const [financial, setFinancial] = useState<Tri>('all')
  const [translatable, setTranslatable] = useState<Tri>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dictRes, trRes] = await Promise.all([
        fetch('/api/settings/data-dictionary', { cache: 'no-store' }),
        fetch('/api/settings/translation-dictionary', { cache: 'no-store' }),
      ])
      if (!dictRes.ok || !trRes.ok) {
        setError(t('forbidden'))
        setEntities([])
        setFields([])
        setTranslations([])
        return
      }
      const dictJson = (await dictRes.json()) as {
        data?: { entities: DictionaryEntity[]; fields: DictionaryField[] }
      }
      const trJson = (await trRes.json()) as { data?: TranslationRegistryEntry[] }
      setEntities(dictJson.data?.entities ?? [])
      setFields(dictJson.data?.fields ?? [])
      setTranslations(trJson.data ?? [])
    } catch {
      setError(t('forbidden'))
    } finally {
      setLoading(false)
    }
  }, [locale])

  useEffect(() => {
    void load()
  }, [load])

  const modules = useMemo(
    () => [...new Set(entities.map((e) => e.module))],
    [entities],
  )

  const filteredFields = useMemo(() => {
    const q = search.trim().toLowerCase()
    return fields.filter((f) => {
      const entity = entities.find((e) => e.code === f.entity_code)
      if (moduleFilter !== 'all' && entity?.module !== moduleFilter) return false
      if (entityFilter !== 'all' && f.entity_code !== entityFilter) return false
      if (sensitive === 'yes' && !f.sensitive) return false
      if (sensitive === 'no' && f.sensitive) return false
      if (financial === 'yes' && !f.financial) return false
      if (financial === 'no' && f.financial) return false
      if (translatable === 'yes' && !f.translatable) return false
      if (translatable === 'no' && f.translatable) return false
      if (!q) return true
      const hay = [
        f.code,
        f.db_column,
        f.api_name,
        f.entity_code,
        entity?.db_table,
        f.description_pt,
        f.description_en,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [
    fields,
    entities,
    search,
    moduleFilter,
    entityFilter,
    sensitive,
    financial,
    translatable,
  ])

  const filteredTranslations = useMemo(() => {
    const q = search.trim().toLowerCase()
    return translations.filter((row) => {
      if (moduleFilter !== 'all' && row.module !== moduleFilter) return false
      if (!q) return true
      return `${row.key} ${row.pt} ${row.en} ${row.es} ${row.module}`
        .toLowerCase()
        .includes(q)
    })
  }, [translations, search, moduleFilter])

  function triSelect(
    label: string,
    value: Tri,
    onChange: (v: Tri) => void,
  ) {
    return (
      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        {label}
        <select
          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800"
          value={value}
          onChange={(e) => onChange(e.target.value as Tri)}
        >
          <option value="all">{t('all')}</option>
          <option value="yes">{t('yes')}</option>
          <option value="no">{t('no')}</option>
        </select>
      </label>
    )
  }

  return (
    <BackofficeTableShell
      title={t('title')}
      subtitle={t('subtitle')}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('filterField')}
      showActiveFilter={false}
      onRefresh={() => void load()}
      loading={loading}
      error={error}
    >
      <p className="mb-3 text-xs text-neutral-500">{t('platformNote')}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm ${tab === 'fields' ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-700'}`}
          onClick={() => setTab('fields')}
        >
          {t('tabFields')}
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm ${tab === 'translations' ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-700'}`}
          onClick={() => setTab('translations')}
        >
          {t('tabTranslations')}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          {t('filterModule')}
          <select
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            <option value="all">{t('all')}</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {tab === 'fields' ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              {t('filterEntity')}
              <select
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm"
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
              >
                <option value="all">{t('all')}</option>
                {entities
                  .filter((e) => e.active)
                  .map((e) => (
                    <option key={e.code} value={e.code}>
                      {e.code}
                    </option>
                  ))}
              </select>
            </label>
            {triSelect(t('filterSensitive'), sensitive, setSensitive)}
            {triSelect(t('filterFinancial'), financial, setFinancial)}
            {triSelect(t('filterTranslatable'), translatable, setTranslatable)}
          </>
        ) : null}
      </div>

      {tab === 'fields' ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-neutral-500">
                <th className="py-2 pr-3">{t('colEntity')}</th>
                <th className="py-2 pr-3">{t('colTable')}</th>
                <th className="py-2 pr-3">{t('colColumn')}</th>
                <th className="py-2 pr-3">{t('colApi')}</th>
                <th className="py-2 pr-3">{t('colType')}</th>
                <th className="py-2 pr-3">{t('colLength')}</th>
                <th className="py-2 pr-3">{t('colRequired')}</th>
                <th className="py-2 pr-3">{t('colPk')}</th>
                <th className="py-2 pr-3">{t('colFk')}</th>
                <th className="py-2 pr-3">{t('colSensitive')}</th>
                <th className="py-2 pr-3">{t('colFinancial')}</th>
                <th className="py-2 pr-3">{t('colTranslatable')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredFields.length === 0 ? (
                <tr>
                  <td className="py-6 text-neutral-500" colSpan={12}>
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                filteredFields.map((f) => {
                  const entity = entities.find((e) => e.code === f.entity_code)
                  return (
                    <tr key={f.code} className="border-b border-neutral-100">
                      <td className="py-1.5 pr-3 font-mono text-xs">{f.entity_code}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs">
                        {entity?.db_table}
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-xs">{f.db_column}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs">{f.api_name}</td>
                      <td className="py-1.5 pr-3 text-xs">{f.data_type}</td>
                      <td className="py-1.5 pr-3 text-xs">
                        {f.max_length ?? '—'}
                      </td>
                      <td className="py-1.5 pr-3">{f.required ? t('yes') : t('no')}</td>
                      <td className="py-1.5 pr-3">{f.primary_key ? t('yes') : t('no')}</td>
                      <td className="py-1.5 pr-3">{f.foreign_key ? t('yes') : t('no')}</td>
                      <td className="py-1.5 pr-3">{f.sensitive ? t('yes') : t('no')}</td>
                      <td className="py-1.5 pr-3">{f.financial ? t('yes') : t('no')}</td>
                      <td className="py-1.5 pr-3">{f.translatable ? t('yes') : t('no')}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-neutral-500">
                <th className="py-2 pr-3">{t('colKey')}</th>
                <th className="py-2 pr-3">{t('colModule')}</th>
                <th className="py-2 pr-3">{t('colContext')}</th>
                <th className="py-2 pr-3">{t('colPt')}</th>
                <th className="py-2 pr-3">{t('colEn')}</th>
                <th className="py-2 pr-3">{t('colEs')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTranslations.length === 0 ? (
                <tr>
                  <td className="py-6 text-neutral-500" colSpan={6}>
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                filteredTranslations.map((row) => (
                  <tr key={row.key} className="border-b border-neutral-100 align-top">
                    <td className="py-1.5 pr-3 font-mono text-xs">{row.key}</td>
                    <td className="py-1.5 pr-3 text-xs">{row.module}</td>
                    <td className="py-1.5 pr-3 text-xs">{row.context}</td>
                    <td className="max-w-[14rem] py-1.5 pr-3 text-xs">{row.pt}</td>
                    <td className="max-w-[14rem] py-1.5 pr-3 text-xs">{row.en}</td>
                    <td className="max-w-[14rem] py-1.5 pr-3 text-xs">{row.es}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </BackofficeTableShell>
  )
}
