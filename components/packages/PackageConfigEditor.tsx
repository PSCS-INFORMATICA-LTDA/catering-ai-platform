'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BackofficeBtnDanger,
  BackofficeBtnOutline,
  BackofficeBtnPrimary,
  BackofficeField,
  BackofficeInput,
} from '@/components/backoffice/BackofficeCardPrimitives'
import { BackofficeFormSectionTitle } from '@/components/backoffice/BackofficeSectionPrimitives'
import OperationalMaterialsBomPanel from '@/components/materials/OperationalMaterialsBomPanel'
import AdditionalItemPicker, {
  type AdditionalItemOption,
} from '@/components/packages/AdditionalItemPicker'
import CatalogImageFrame from '@/components/CatalogImageFrame'
import { resolveCatalogItemImageForLink } from '@/Lib/catalogItemVisual'
import { slugFromItemName } from '@/Lib/packageConfigKeys'
import { filterCatalogItems } from '@/Lib/itemCatalog'
import type { PackageItem, PackageSideItem } from '@/Lib/packageConfiguration'
import type { PackageOptionGroup, PackageOptionGroupItem } from '@/Lib/packageOptionGroups'

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const json = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(json.error ?? 'Erro na requisição.')
  return json
}

function applyAdditionalDefaults(
  additional: AdditionalItemOption | null,
  current: {
    item_key?: string | null
    item_name?: string | null
    label_pt?: string | null
  },
) {
  if (!additional) return current
  const name = (additional.item_name ?? additional.label_pt ?? '').trim()
  return {
    item_key:
      current.item_key?.trim() ||
      additional.item_key?.trim() ||
      slugFromItemName(name) ||
      '',
    item_name: current.item_name?.trim() || name || null,
    label_pt:
      current.label_pt?.trim() || additional.label_pt?.trim() || name || null,
  }
}

export default function PackageConfigEditor({
  packageId,
  itemCatalog,
  onChanged,
}: {
  packageId: string
  itemCatalog: AdditionalItemOption[]
  onChanged?: () => void
}) {
  const packageItemCatalog = useMemo(
    () => filterCatalogItems(itemCatalog, 'package_item', 'customer'),
    [itemCatalog],
  )
  const sideItemCatalog = useMemo(
    () => filterCatalogItems(itemCatalog, 'side_item', 'customer'),
    [itemCatalog],
  )
  const optionChoiceCatalog = useMemo(
    () => filterCatalogItems(itemCatalog, 'option_choice', 'customer'),
    [itemCatalog],
  )
  const [items, setItems] = useState<PackageItem[]>([])
  const [sides, setSides] = useState<PackageSideItem[]>([])
  const [groups, setGroups] = useState<PackageOptionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [itemsRes, sidesRes, groupsRes] = await Promise.all([
        apiJson<{ data: PackageItem[] }>(
          `/api/package-items?package_id=${encodeURIComponent(packageId)}`,
        ),
        apiJson<{ data: PackageSideItem[] }>(
          `/api/package-side-items?package_id=${encodeURIComponent(packageId)}`,
        ),
        apiJson<{ data: PackageOptionGroup[] }>(
          `/api/package-option-groups?package_id=${encodeURIComponent(packageId)}&active=all`,
        ),
      ])
      setItems(itemsRes.data ?? [])
      setSides(sidesRes.data ?? [])
      setGroups(groupsRes.data ?? [])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar configuração.',
      )
    } finally {
      setLoading(false)
    }
  }, [packageId])

  useEffect(() => {
    void reload()
  }, [reload])

  async function saveRow(
    kind: 'item' | 'side' | 'group' | 'option',
    id: string | 'new',
    payload: Record<string, unknown>,
    groupId?: string,
  ) {
    setSavingId(id === 'new' ? `new-${kind}` : id)
    setError(null)
    try {
      if (kind === 'item') {
        if (id === 'new') {
          await apiJson('/api/package-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, package_id: packageId }),
          })
        } else {
          await apiJson(`/api/package-items/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        }
      } else if (kind === 'side') {
        if (id === 'new') {
          await apiJson('/api/package-side-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, package_id: packageId }),
          })
        } else {
          await apiJson(`/api/package-side-items/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        }
      } else if (kind === 'group') {
        if (id === 'new') {
          await apiJson('/api/package-option-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, package_id: packageId }),
          })
        } else {
          await apiJson(`/api/package-option-groups/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        }
      } else if (kind === 'option') {
        if (!groupId) throw new Error('Grupo inválido.')
        if (id === 'new') {
          await apiJson('/api/package-option-group-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, option_group_id: groupId }),
          })
        } else {
          await apiJson(`/api/package-option-group-items/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        }
      }
      await reload()
      onChanged?.()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Erro ao salvar.',
      )
    } finally {
      setSavingId(null)
    }
  }

  async function deleteRow(
    kind: 'item' | 'side' | 'group' | 'option',
    id: string,
  ) {
    if (!window.confirm('Excluir este registro?')) return
    setSavingId(id)
    setError(null)
    try {
      const paths = {
        item: `/api/package-items/${id}`,
        side: `/api/package-side-items/${id}`,
        group: `/api/package-option-groups/${id}`,
        option: `/api/package-option-group-items/${id}`,
      }
      await apiJson(paths[kind], { method: 'DELETE' })
      await reload()
      onChanged?.()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Erro ao excluir.',
      )
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Carregando configuração…</p>
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <InventorySection
        title="Itens fixos do pacote"
        rows={items}
        catalogItems={packageItemCatalog}
        linkedItemType="PRODUCT"
        pickerPlaceholder="Selecionar item do cadastro…"
        savingId={savingId}
        onSave={(id, payload) => void saveRow('item', id, payload)}
        onDelete={(id) => void deleteRow('item', id)}
        onAdd={() =>
          void saveRow('item', 'new', {
            item_key: '',
            item_name: '',
            label_pt: '',
            display_order: items.length,
            included: true,
            blocks_additional_item: true,
            active: true,
          })
        }
      />

      <InventorySection
        title="Guarnições"
        rows={sides}
        catalogItems={sideItemCatalog}
        linkedItemType="SIDE"
        pickerPlaceholder="Selecionar guarnição do cadastro…"
        savingId={savingId}
        onSave={(id, payload) => void saveRow('side', id, payload)}
        onDelete={(id) => void deleteRow('side', id)}
        onAdd={() =>
          void saveRow('side', 'new', {
            item_key: '',
            item_name: '',
            label_pt: '',
            display_order: sides.length,
            included: true,
            blocks_additional_item: true,
            active: true,
          })
        }
      />

      <OptionGroupsSection
        groups={groups}
        catalogItems={optionChoiceCatalog}
        savingId={savingId}
        onSaveGroup={(id, payload) => void saveRow('group', id, payload)}
        onDeleteGroup={(id) => void deleteRow('group', id)}
        onSaveOption={(groupId, id, payload) =>
          void saveRow('option', id, payload, groupId)
        }
        onDeleteOption={(id) => void deleteRow('option', id)}
        onAddGroup={() =>
          void saveRow('group', 'new', {
            option_group_key: '',
            group_key: '',
            label_pt: '',
            required: true,
            min_choices: 1,
            max_choices: 1,
            blocks_additional_items: true,
            display_order: groups.length,
            active: true,
          })
        }
        onAddOption={(groupId) =>
          void saveRow(
            'option',
            'new',
            {
              option_item_key: '',
              label_pt: '',
              display_order:
                groups.find((g) => g.id === groupId)?.items.length ?? 0,
              active: true,
              price_delta: 0,
            },
            groupId,
          )
        }
      />

      <OperationalMaterialsBomPanel
        sourceType="package"
        sourceId={packageId}
        canManage
      />
    </div>
  )
}

function InventorySection({
  title,
  rows,
  catalogItems,
  linkedItemType,
  pickerPlaceholder,
  savingId,
  onSave,
  onDelete,
  onAdd,
}: {
  title: string
  rows: Array<PackageItem | PackageSideItem>
  catalogItems: AdditionalItemOption[]
  linkedItemType: 'PRODUCT' | 'SIDE' | 'PACKAGE_ITEM'
  pickerPlaceholder?: string
  savingId: string | null
  onSave: (id: string, payload: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onAdd: () => void
}) {
  return (
    <section className="space-y-3">
      <BackofficeFormSectionTitle>{title}</BackofficeFormSectionTitle>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum registro cadastrado.</p>
      ) : (
        rows.map((row) => (
          <InventoryRowEditor
            key={row.id}
            row={row}
            catalogItems={catalogItems}
            linkedItemType={linkedItemType}
            pickerPlaceholder={pickerPlaceholder}
            saving={savingId === row.id}
            onSave={(payload) => onSave(row.id, payload)}
            onDelete={() => onDelete(row.id)}
          />
        ))
      )}
      <BackofficeBtnOutline onClick={onAdd}>Adicionar linha</BackofficeBtnOutline>
    </section>
  )
}

function InventoryRowEditor({
  row,
  catalogItems,
  linkedItemType,
  pickerPlaceholder,
  saving,
  onSave,
  onDelete,
}: {
  row: PackageItem | PackageSideItem
  catalogItems: AdditionalItemOption[]
  linkedItemType: 'PRODUCT' | 'SIDE' | 'PACKAGE_ITEM'
  pickerPlaceholder?: string
  saving: boolean
  onSave: (payload: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(row)

  useEffect(() => {
    setDraft(row)
  }, [row])

  const visual = resolveCatalogItemImageForLink(catalogItems, {
    additional_item_id: draft.additional_item_id,
    image_url: draft.image_url,
    item_type: linkedItemType,
    category_pt: draft.label_pt,
  })

  return (
    <div className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2 lg:col-span-3">
        <CatalogImageFrame
          src={visual.imageUrl}
          alt={draft.label_pt?.trim() || draft.item_name?.trim() || 'Item'}
          variant="catalogItem"
          itemType={visual.itemType ?? linkedItemType}
          categoryPt={visual.categoryPt}
          imageStatus={visual.imageStatus}
          size="thumbnail"
          rounded="all"
          className="!inline-flex !w-20"
        />
      </div>
      <BackofficeField label="Item do cadastro" className="sm:col-span-2 lg:col-span-3">
        <AdditionalItemPicker
          catalogItems={catalogItems}
          placeholder={pickerPlaceholder}
          value={String(draft.additional_item_id ?? '')}
          onChange={(id, item) => {
            const next = applyAdditionalDefaults(item, draft)
            setDraft(
              (c) =>
                ({
                  ...c,
                  additional_item_id: id || null,
                  item_key: next.item_key ?? c.item_key,
                  item_name: next.item_name ?? c.item_name,
                  label_pt: next.label_pt ?? c.label_pt,
                }) as PackageItem | PackageSideItem,
            )
          }}
        />
      </BackofficeField>
      <BackofficeField label="Chave">
        <BackofficeInput
          value={draft.item_key ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, item_key: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Nome">
        <BackofficeInput
          value={draft.item_name ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, item_name: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Rótulo PT">
        <BackofficeInput
          value={draft.label_pt ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, label_pt: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Ordem">
        <BackofficeInput
          type="number"
          value={draft.display_order ?? 0}
          onChange={(v) =>
            setDraft((c) => ({ ...c, display_order: Number(v) }))
          }
        />
      </BackofficeField>
      <BackofficeField label="Bloqueia adicional duplicado">
        <select
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          value={draft.blocks_additional_item === false ? 'false' : 'true'}
          onChange={(e) =>
            setDraft((c) => ({
              ...c,
              blocks_additional_item: e.target.value === 'true',
            }))
          }
        >
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      </BackofficeField>
      <BackofficeField label="Ativo">
        <select
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          value={draft.active === false ? 'false' : 'true'}
          onChange={(e) =>
            setDraft((c) => ({ ...c, active: e.target.value === 'true' }))
          }
        >
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      </BackofficeField>
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
        <BackofficeBtnPrimary disabled={saving} onClick={() => onSave(draft)}>
          {saving ? 'Salvando…' : 'Salvar linha'}
        </BackofficeBtnPrimary>
        <BackofficeBtnDanger onClick={onDelete}>Excluir</BackofficeBtnDanger>
      </div>
    </div>
  )
}

function OptionGroupsSection({
  groups,
  catalogItems,
  savingId,
  onSaveGroup,
  onDeleteGroup,
  onSaveOption,
  onDeleteOption,
  onAddGroup,
  onAddOption,
}: {
  groups: PackageOptionGroup[]
  catalogItems: AdditionalItemOption[]
  savingId: string | null
  onSaveGroup: (id: string, payload: Record<string, unknown>) => void
  onDeleteGroup: (id: string) => void
  onSaveOption: (
    groupId: string,
    id: string,
    payload: Record<string, unknown>,
  ) => void
  onDeleteOption: (id: string) => void
  onAddGroup: () => void
  onAddOption: (groupId: string) => void
}) {
  return (
    <section className="space-y-4">
      <BackofficeFormSectionTitle>Escolhas inclusas</BackofficeFormSectionTitle>
      {groups.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum grupo cadastrado.</p>
      ) : (
        groups.map((group) => (
          <OptionGroupEditor
            key={group.id}
            group={group}
            catalogItems={catalogItems}
            savingId={savingId}
            onSaveGroup={(payload) => onSaveGroup(group.id, payload)}
            onDeleteGroup={() => onDeleteGroup(group.id)}
            onSaveOption={(optionId, payload) =>
              onSaveOption(group.id, optionId, payload)
            }
            onDeleteOption={onDeleteOption}
            onAddOption={() => onAddOption(group.id)}
          />
        ))
      )}
      <BackofficeBtnOutline onClick={onAddGroup}>Adicionar grupo</BackofficeBtnOutline>
    </section>
  )
}

function OptionGroupEditor({
  group,
  catalogItems,
  savingId,
  onSaveGroup,
  onDeleteGroup,
  onSaveOption,
  onDeleteOption,
  onAddOption,
}: {
  group: PackageOptionGroup
  catalogItems: AdditionalItemOption[]
  savingId: string | null
  onSaveGroup: (payload: Record<string, unknown>) => void
  onDeleteGroup: () => void
  onSaveOption: (id: string, payload: Record<string, unknown>) => void
  onDeleteOption: (id: string) => void
  onAddOption: () => void
}) {
  const [draft, setDraft] = useState(group)

  useEffect(() => {
    setDraft(group)
  }, [group])

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <BackofficeField label="Chave do grupo">
          <BackofficeInput
            value={draft.option_group_key ?? ''}
            onChange={(v) =>
              setDraft((c) => ({
                ...c,
                option_group_key: v,
                group_key: v,
              }))
            }
          />
        </BackofficeField>
        <BackofficeField label="Rótulo PT">
          <BackofficeInput
            value={draft.label_pt ?? ''}
            onChange={(v) => setDraft((c) => ({ ...c, label_pt: v }))}
          />
        </BackofficeField>
        <BackofficeField label="Obrigatório">
          <select
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            value={draft.required === false ? 'false' : 'true'}
            onChange={(e) =>
              setDraft((c) => ({ ...c, required: e.target.value === 'true' }))
            }
          >
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </BackofficeField>
        <BackofficeField label="Bloqueia adicionais do grupo">
          <select
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            value={draft.blocks_additional_items === false ? 'false' : 'true'}
            onChange={(e) =>
              setDraft((c) => ({
                ...c,
                blocks_additional_items: e.target.value === 'true',
              }))
            }
          >
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </BackofficeField>
        <BackofficeField label="Ordem">
          <BackofficeInput
            type="number"
            value={draft.display_order ?? 0}
            onChange={(v) =>
              setDraft((c) => ({ ...c, display_order: Number(v) }))
            }
          />
        </BackofficeField>
      </div>
      <div className="flex flex-wrap gap-2">
        <BackofficeBtnPrimary
          disabled={savingId === group.id}
          onClick={() => onSaveGroup(draft)}
        >
          Salvar grupo
        </BackofficeBtnPrimary>
        <BackofficeBtnDanger onClick={onDeleteGroup}>Excluir grupo</BackofficeBtnDanger>
      </div>

      <div className="space-y-2 border-t border-amber-200/80 pt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-600">
          Opções do grupo
        </p>
        {group.items.map((item) => (
          <OptionItemEditor
            key={item.id}
            item={item}
            catalogItems={catalogItems}
            saving={savingId === item.id}
            onSave={(payload) => onSaveOption(item.id, payload)}
            onDelete={() => onDeleteOption(item.id)}
          />
        ))}
        <BackofficeBtnOutline onClick={onAddOption}>
          Adicionar opção
        </BackofficeBtnOutline>
      </div>
    </div>
  )
}

function OptionItemEditor({
  item,
  catalogItems,
  saving,
  onSave,
  onDelete,
}: {
  item: PackageOptionGroupItem
  catalogItems: AdditionalItemOption[]
  saving: boolean
  onSave: (payload: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(item)

  useEffect(() => {
    setDraft(item)
  }, [item])

  const visual = resolveCatalogItemImageForLink(catalogItems, {
    additional_item_id: draft.additional_item_id,
    item_type: 'PRODUCT',
    category_pt: draft.label_pt,
  })

  return (
    <div className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2 lg:col-span-3">
        <CatalogImageFrame
          src={visual.imageUrl}
          alt={draft.label_pt?.trim() || draft.option_item_key?.trim() || 'Opção'}
          variant="catalogItem"
          itemType={visual.itemType ?? 'PRODUCT'}
          categoryPt={visual.categoryPt}
          imageStatus={visual.imageStatus}
          size="thumbnail"
          rounded="all"
          className="!inline-flex !w-20"
        />
      </div>
      <BackofficeField label="Item do cadastro" className="sm:col-span-2 lg:col-span-3">
        <AdditionalItemPicker
          catalogItems={catalogItems}
          placeholder="Selecionar escolha do cadastro…"
          value={String(draft.additional_item_id ?? '')}
          onChange={(id, additional) => {
            const name = (
              additional?.item_name ??
              additional?.label_pt ??
              ''
            ).trim()
            setDraft((c) => ({
              ...c,
              additional_item_id: id || null,
              label_pt: c.label_pt?.trim() || name,
              option_item_key:
                c.option_item_key?.trim() ||
                (name ? slugFromItemName(name) : ''),
            }))
          }}
        />
      </BackofficeField>
      <BackofficeField label="Chave da opção">
        <BackofficeInput
          value={draft.option_item_key ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, option_item_key: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Rótulo PT">
        <BackofficeInput
          value={draft.label_pt ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, label_pt: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Ordem">
        <BackofficeInput
          type="number"
          value={draft.display_order ?? 0}
          onChange={(v) =>
            setDraft((c) => ({ ...c, display_order: Number(v) }))
          }
        />
      </BackofficeField>
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
        <BackofficeBtnPrimary disabled={saving} onClick={() => onSave(draft)}>
          Salvar opção
        </BackofficeBtnPrimary>
        <BackofficeBtnDanger onClick={onDelete}>Excluir opção</BackofficeBtnDanger>
      </div>
    </div>
  )
}
