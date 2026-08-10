'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BackofficeTableShell from '@/components/BackofficeTableShell'
import {
  BackofficeBtnDanger,
  BackofficeBtnOutline,
  BackofficeBtnPrimary,
  BackofficeBtnSecondary,
  BackofficeFormCard,
  BackofficeMetaRow,
  BackofficeStatusBadge,
} from '@/components/backoffice/BackofficeCardPrimitives'
import {
  AdditionalItemAdminFormFields,
  EMPTY_ADDITIONAL_ITEM_ROW,
  additionalItemDraftFromListItem,
} from '@/components/backoffice/AdditionalItemAdminFormFields'
import {
  BackofficeCascadeLayout,
  BackofficeCascadeListButton,
  BackofficeCascadePanel,
  BackofficeInventoryButton,
} from '@/components/backoffice/BackofficeSectionPrimitives'
import OperationalMaterialsBomPanel from '@/components/materials/OperationalMaterialsBomPanel'
import CatalogImageFrame from '@/components/CatalogImageFrame'
import {
  groupAdditionalItemsByCategory,
  normalizeAdditionalItemDraft,
} from '@/Lib/additionalItemCatalogAdmin'
import {
  getAdditionalItemCategoryLabel,
  getAdditionalItemCurrencyCode,
  getAdditionalItemDisplayOrder,
  getAdditionalItemImageUrl,
  getAdditionalItemLabel,
  mapAdditionalItemDraftToDeployed,
} from '@/Lib/additionalItemFieldAccess'
import type { CatalogItemListItem } from '@/Lib/fetchCatalogItems'
import { formatUsd } from '@/Lib/backofficeFinance'
import { getAdditionalItemPrice } from '@/Lib/getAdditionalItemPrice'
import type { CatalogItemsInsertPayload } from '@/Lib/catalogItemsTableSchema'

type ActiveFilter = 'active' | 'all'
type MobileStep = 'categories' | 'items' | 'detail'

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])

async function fetchItemsFromApi(
  query: string,
  activeFilter: ActiveFilter,
): Promise<CatalogItemListItem[]> {
  const params = new URLSearchParams({ _: String(Date.now()) })
  if (query.trim()) params.set('q', query.trim())
  params.set('active', activeFilter === 'all' ? 'all' : 'true')

  const response = await fetch(`/api/additional-items?${params.toString()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  })
  const result = (await response.json()) as {
    data?: CatalogItemListItem[]
    error?: string
  }
  if (!response.ok) {
    throw new Error(result.error ?? 'Não foi possível buscar itens.')
  }
  return result.data ?? []
}

function formatFlag(value: boolean | null | undefined): string {
  if (value === true) return 'Sim'
  if (value === false) return 'Não'
  return '—'
}

function formatCatalogUsageFlags(item: CatalogItemListItem): string {
  const parts: string[] = []
  if (item.can_be_package_item !== false) parts.push('Pacote')
  if (item.can_be_side_item) parts.push('Guarnição')
  if (item.can_be_additional !== false) parts.push('Adicional')
  if (item.can_be_option_choice !== false) parts.push('Escolha')
  if (item.inventory_enabled) parts.push('Estoque')
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function chargeLabel(item: CatalogItemListItem | CatalogItemsInsertPayload) {
  if (item.pricing_type === 'PER_PERSON' || item.charge_type === 'PERSON') {
    return 'por pessoa'
  }
  return 'por unidade'
}

export default function AdditionalItemsDashboard({
  initialItems,
}: {
  initialItems: CatalogItemListItem[]
}) {
  const [items, setItems] = useState<CatalogItemListItem[]>(initialItems)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<CatalogItemsInsertPayload>(EMPTY_ADDITIONAL_ITEM_ROW)
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [mobileStep, setMobileStep] = useState<MobileStep>('categories')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetIdRef = useRef<string | null>(null)

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      [
        item.item_key,
        item.item_name,
        item.label_pt,
        item.category_pt,
        item.category_key,
        getAdditionalItemCategoryLabel(item),
        getAdditionalItemLabel(item),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [items, search])

  const grouped = useMemo(
    () => groupAdditionalItemsByCategory(filteredItems),
    [filteredItems],
  )

  const selectedGroup = useMemo(
    () => grouped.find((g) => g.categoryKey === selectedCategoryKey) ?? null,
    [grouped, selectedCategoryKey],
  )

  const categoryItems = selectedGroup?.items ?? []

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  )

  useEffect(() => {
    if (grouped.length === 0) {
      setSelectedCategoryKey(null)
      setSelectedItemId(null)
      return
    }
    if (
      !selectedCategoryKey ||
      !grouped.some((g) => g.categoryKey === selectedCategoryKey)
    ) {
      setSelectedCategoryKey(grouped[0].categoryKey)
    }
  }, [grouped, selectedCategoryKey])

  useEffect(() => {
    if (categoryItems.length === 0) {
      setSelectedItemId(null)
      return
    }
    if (!selectedItemId || !categoryItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(categoryItems[0].id)
    }
  }, [categoryItems, selectedItemId])

  const refreshItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchItemsFromApi(search, activeFilter))
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Erro ao atualizar itens.',
      )
    } finally {
      setLoading(false)
    }
  }, [search, activeFilter])

  useEffect(() => {
    void refreshItems()
  }, [activeFilter])

  function selectCategory(categoryKey: string) {
    setSelectedCategoryKey(categoryKey)
    setMobileStep('items')
    const first = grouped.find((g) => g.categoryKey === categoryKey)?.items[0]
    setSelectedItemId(first?.id ?? null)
  }

  function selectItem(itemId: string) {
    setSelectedItemId(itemId)
    setMobileStep('detail')
    if (editingId && editingId !== itemId) {
      setEditingId(null)
      setDraft({ ...EMPTY_ADDITIONAL_ITEM_ROW })
    }
  }

  function startNew() {
    setEditingId('new')
    setDraft({ ...EMPTY_ADDITIONAL_ITEM_ROW })
    setMobileStep('detail')
  }

  function startEdit(item: CatalogItemListItem) {
    setEditingId(item.id)
    setSelectedItemId(item.id)
    setDraft(additionalItemDraftFromListItem(item))
    setMobileStep('detail')
  }

  function triggerUpload(itemId: string) {
    uploadTargetIdRef.current = itemId
    fileInputRef.current?.click()
  }

  async function handleFileSelected(file: File | undefined) {
    const itemId = uploadTargetIdRef.current
    if (!file || !itemId) return

    if (!ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      const message = 'Formato inválido. Use PNG, JPG, JPEG ou WebP.'
      setUploadErrors((current) => ({ ...current, [itemId]: message }))
      setError(message)
      uploadTargetIdRef.current = null
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploadingId(itemId)
    setUploadErrors((current) => {
      const next = { ...current }
      delete next[itemId]
      return next
    })
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/additional-items/${itemId}/image`, {
        method: 'POST',
        body: formData,
      })
      const result = (await response.json()) as {
        success?: boolean
        image_url?: string
        item?: CatalogItemListItem
        error?: string
      }

      if (!response.ok || !result.success || !result.item) {
        throw new Error(result.error ?? 'Falha no upload da imagem.')
      }

      setItems((current) =>
        current.map((row) => (row.id === itemId ? { ...row, ...result.item } : row)),
      )

      if (editingId === itemId) {
        setDraft((current) => ({
          ...current,
          image_url: result.item?.image_url ?? result.image_url ?? current.image_url,
          image_status: result.item?.image_status ?? 'ready',
          image_notes:
            result.item?.image_notes ??
            'Imagem atualizada pelo cadastro de itens.',
        }))
      }
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : 'Erro ao enviar imagem.'
      setUploadErrors((current) => ({ ...current, [itemId]: message }))
      setError(message)
    } finally {
      setUploadingId(null)
      uploadTargetIdRef.current = null
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft({ ...EMPTY_ADDITIONAL_ITEM_ROW })
  }

  async function saveRow() {
    setSaving(true)
    setError(null)
    const payload = mapAdditionalItemDraftToDeployed(
      normalizeAdditionalItemDraft({
        ...draft,
        price: getAdditionalItemPrice(draft),
      }),
    )
    try {
      const url =
        editingId && editingId !== 'new'
          ? `/api/additional-items/${editingId}`
          : '/api/additional-items'
      const method = editingId && editingId !== 'new' ? 'PATCH' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(result.error ?? 'Não foi possível salvar item.')
      }
      cancelEdit()
      await refreshItems()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Erro ao salvar item.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(item: CatalogItemListItem) {
    const label = getAdditionalItemLabel(item)
    if (!window.confirm(`Inativar "${label}"?`)) return
    const response = await fetch(`/api/additional-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    const result = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(result.error ?? 'Não foi possível inativar item.')
      return
    }
    setItems((current) => current.filter((row) => row.id !== item.id))
    if (selectedItemId === item.id) setSelectedItemId(null)
  }

  function renderDetailPanel() {
    if (editingId === 'new') {
      return (
        <BackofficeCascadePanel
          title="Novo item"
          className="lg:col-span-5"
          onBack={() => {
            cancelEdit()
            setMobileStep('items')
          }}
        >
          <BackofficeFormCard
            title="Cadastro"
            actions={
              <>
                <BackofficeBtnPrimary
                  onClick={() => void saveRow()}
                  disabled={saving}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </BackofficeBtnPrimary>
                <BackofficeBtnSecondary onClick={cancelEdit}>
                  Cancelar
                </BackofficeBtnSecondary>
              </>
            }
          >
            <AdditionalItemAdminFormFields draft={draft} setDraft={setDraft} />
          </BackofficeFormCard>
        </BackofficeCascadePanel>
      )
    }

    if (!selectedItem) {
      return (
        <BackofficeCascadePanel
          title="Detalhe"
          subtitle="Selecione um item"
          className="lg:col-span-5"
          onBack={() => setMobileStep('items')}
        >
          <p className="text-sm text-neutral-500">
            Escolha uma categoria e um item para ver os detalhes.
          </p>
        </BackofficeCascadePanel>
      )
    }

    const isEditing = editingId === selectedItem.id
    const itemKey = selectedItem.item_key ?? '—'
    const displayName = getAdditionalItemLabel(selectedItem)
    const imageUrl = isEditing
      ? String(draft.image_url ?? '').trim() || null
      : getAdditionalItemImageUrl(selectedItem)
    const price = getAdditionalItemPrice(isEditing ? draft : selectedItem)
    const uploadError = uploadErrors[selectedItem.id]
    const categoryLabel = getAdditionalItemCategoryLabel(selectedItem)
    const currency = getAdditionalItemCurrencyCode(selectedItem)

    if (isEditing) {
      return (
        <BackofficeCascadePanel
          title={`Editar · ${itemKey}`}
          className="lg:col-span-5"
          onBack={() => {
            cancelEdit()
            setMobileStep('items')
          }}
        >
          <div className="mb-4 max-w-xs">
            <CatalogImageFrame
              src={imageUrl}
              alt={displayName}
              variant="catalogItem"
              itemType={
                (isEditing ? draft.item_type : selectedItem.item_type) as
                  | string
                  | null
                  | undefined
              }
              categoryPt={
                String(isEditing ? draft.category_pt ?? '' : selectedItem.category_pt ?? '') ||
                null
              }
              imageStatus={
                isEditing ? String(draft.image_status ?? '') : selectedItem.image_status
              }
              fallbackLabel="Sem imagem cadastrada"
              rounded="all"
              className="!aspect-square !min-h-0 !max-h-none"
            />
          </div>
          <BackofficeFormCard
            title="Editar item"
            actions={
              <>
                <BackofficeBtnPrimary
                  onClick={() => void saveRow()}
                  disabled={saving}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </BackofficeBtnPrimary>
                <BackofficeBtnSecondary onClick={cancelEdit}>
                  Cancelar
                </BackofficeBtnSecondary>
                <BackofficeBtnOutline
                  accent
                  onClick={() => triggerUpload(selectedItem.id)}
                  disabled={uploadingId === selectedItem.id}
                >
                  {uploadingId === selectedItem.id ? 'Enviando…' : 'Enviar imagem'}
                </BackofficeBtnOutline>
              </>
            }
          >
            <AdditionalItemAdminFormFields draft={draft} setDraft={setDraft} />
            {selectedItem.id !== 'new' ? (
              <OperationalMaterialsBomPanel
                sourceType="additional"
                sourceId={selectedItem.id}
                canManage
              />
            ) : null}
          </BackofficeFormCard>
        </BackofficeCascadePanel>
      )
    }

    return (
      <BackofficeCascadePanel
        title={displayName}
        subtitle={categoryLabel}
        className="lg:col-span-5 overflow-hidden !p-0"
        onBack={() => setMobileStep('items')}
      >
        <div className="flex aspect-square w-full items-center justify-center bg-neutral-50">
          <CatalogImageFrame
            src={imageUrl}
            alt={displayName}
            variant="catalogItem"
            itemType={selectedItem.item_type}
            categoryPt={selectedItem.category_pt}
            imageStatus={selectedItem.image_status}
            fallbackLabel="Sem imagem cadastrada"
            rounded="none"
            className="!h-full !min-h-0 !max-h-none !w-full !rounded-none"
          />
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              {itemKey}
            </span>
            <BackofficeStatusBadge active={selectedItem.active !== false} />
          </div>
          <h3 className="text-2xl font-bold text-neutral-900">{displayName}</h3>
          <BackofficeMetaRow label="Categoria" value={categoryLabel} />
          <BackofficeMetaRow
            label="Tipo"
            value={selectedItem.item_type ?? 'PRODUCT'}
          />
          <BackofficeMetaRow
            label="Preço vigente"
            value={formatUsd(getAdditionalItemPrice(selectedItem))}
          />
          <BackofficeMetaRow
            label="sale_price"
            value={
              selectedItem.sale_price != null
                ? formatUsd(Number(selectedItem.sale_price))
                : '—'
            }
          />
          <BackofficeMetaRow
            label="price (legado)"
            value={
              selectedItem.price != null
                ? formatUsd(Number(selectedItem.price))
                : '—'
            }
          />
          <BackofficeMetaRow
            label="Uso no sistema"
            value={formatCatalogUsageFlags(selectedItem)}
          />
          <BackofficeMetaRow
            label="Visível ao cliente"
            value={formatFlag(selectedItem.customer_visible !== false)}
          />
          <BackofficeMetaRow label="Ativo" value={formatFlag(selectedItem.active !== false)} />
          <BackofficeMetaRow label="Cobrança" value={chargeLabel(selectedItem)} />
          <BackofficeMetaRow label="pricing_type" value={selectedItem.pricing_type ?? '—'} />
          <BackofficeMetaRow label="charge_type" value={selectedItem.charge_type ?? '—'} />
          <BackofficeMetaRow label="unit_label" value={selectedItem.unit_label ?? '—'} />
          <BackofficeMetaRow label="Moeda" value={currency} />
          <BackofficeMetaRow label="Ordem" value={getAdditionalItemDisplayOrder(selectedItem)} />
          {uploadError ? (
            <p className="text-xs text-red-600">{uploadError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <BackofficeBtnSecondary onClick={() => startEdit(selectedItem)}>
              Editar
            </BackofficeBtnSecondary>
            <BackofficeBtnOutline
              accent
              onClick={() => triggerUpload(selectedItem.id)}
              disabled={uploadingId === selectedItem.id}
            >
              {uploadingId === selectedItem.id ? 'Enviando…' : 'Imagem'}
            </BackofficeBtnOutline>
            <BackofficeInventoryButton
              source="additional_item"
              id={selectedItem.id}
            />
            {selectedItem.active !== false ? (
              <BackofficeBtnDanger onClick={() => void deactivate(selectedItem)}>
                Inativar
              </BackofficeBtnDanger>
            ) : null}
          </div>
          <OperationalMaterialsBomPanel
            sourceType="additional"
            sourceId={selectedItem.id}
            canManage
          />
        </div>
      </BackofficeCascadePanel>
    )
  }

  const showCategories = mobileStep === 'categories'
  const showItems = mobileStep === 'items'
  const showDetail = mobileStep === 'detail' || editingId === 'new'

  return (
    <BackofficeTableShell
      title="Cadastro de itens"
      subtitle="Catálogo mestre · Catering AI"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Nome, chave ou categoria"
      activeFilter={activeFilter}
      onActiveFilterChange={setActiveFilter}
      onRefresh={() => void refreshItems()}
      loading={loading}
      error={error}
      actions={
        <>
          <button
            type="button"
            onClick={startNew}
            className="cdl-btn-primary inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-3 text-sm font-bold"
          >
            Novo item
          </button>
          <Link
            href="/packages/images#catalogo-itens"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-800 shadow-sm"
          >
            Imagens
          </Link>
        </>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
      />

      {filteredItems.length === 0 ? (
        <p className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 shadow-sm">
          {loading ? 'Carregando…' : 'Nenhum item encontrado.'}
        </p>
      ) : (
        <BackofficeCascadeLayout>
          <div
            className={
              showCategories
                ? 'block lg:col-span-3'
                : 'hidden lg:block lg:col-span-3'
            }
          >
            <BackofficeCascadePanel
              title="Categorias"
              subtitle={`${grouped.length} categorias`}
            >
              <div className="space-y-2">
                {grouped.map(({ categoryKey, categoryLabel, items: catItems }) => (
                  <BackofficeCascadeListButton
                    key={categoryKey}
                    active={selectedCategoryKey === categoryKey}
                    onClick={() => selectCategory(categoryKey)}
                  >
                    <span>{categoryLabel}</span>
                    <span className="text-xs text-neutral-400">
                      {catItems.length}
                    </span>
                  </BackofficeCascadeListButton>
                ))}
              </div>
            </BackofficeCascadePanel>
          </div>

          <div
            className={
              showItems ? 'block lg:col-span-4' : 'hidden lg:block lg:col-span-4'
            }
          >
            <BackofficeCascadePanel
              title={selectedGroup?.categoryLabel ?? 'Itens'}
              subtitle={
                selectedGroup
                  ? `${categoryItems.length} itens`
                  : 'Selecione uma categoria'
              }
              onBack={() => setMobileStep('categories')}
            >
              <div className="space-y-2">
                {categoryItems.map((item) => (
                  <BackofficeCascadeListButton
                    key={item.id}
                    active={selectedItemId === item.id}
                    onClick={() => selectItem(item.id)}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <CatalogImageFrame
                        src={getAdditionalItemImageUrl(item)}
                        alt={getAdditionalItemLabel(item)}
                        variant="catalogItem"
                        itemType={item.item_type}
                        categoryPt={item.category_pt}
                        imageStatus={item.image_status}
                        size="thumbnail"
                        rounded="all"
                        className="!h-12 !w-12"
                      />
                      <div className="min-w-0">
                        <span className="block truncate">{getAdditionalItemLabel(item)}</span>
                        <span className="text-xs text-neutral-400">
                          {item.item_type ?? 'PRODUCT'} · {formatUsd(getAdditionalItemPrice(item))}
                        </span>
                      </div>
                    </div>
                  </BackofficeCascadeListButton>
                ))}
              </div>
            </BackofficeCascadePanel>
          </div>

          <div
            className={
              showDetail
                ? 'block lg:col-span-5'
                : 'hidden lg:block lg:col-span-5'
            }
          >
            {renderDetailPanel()}
          </div>
        </BackofficeCascadeLayout>
      )}
    </BackofficeTableShell>
  )
}
