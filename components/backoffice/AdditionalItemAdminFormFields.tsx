'use client'

import {
  BackofficeField,
  BackofficeInput,
  BackofficeSelect,
} from '@/components/backoffice/BackofficeCardPrimitives'
import { BackofficeFormSectionTitle } from '@/components/backoffice/BackofficeSectionPrimitives'
import { ADDITIONAL_ITEM_CATEGORY_ORDER } from '@/Lib/additionalItemCatalogAdmin'
import type { CatalogItemsInsertPayload } from '@/Lib/catalogItemsTableSchema'
import { tCommon } from '@/Lib/i18n/common'
import { tPackages } from '@/Lib/i18n/packages'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

export const EMPTY_CATALOG_ITEM_ROW: CatalogItemsInsertPayload = {
  item_key: '',
  item_name: '',
  label_pt: '',
  label_en: '',
  label_es: '',
  category_key: '',
  category_pt: '',
  category_en: '',
  category_es: '',
  price: 0,
  charge_type: 'UNIT',
  pricing_type: 'PER_UNIT',
  unit_label: 'UN',
  currency_code: 'USD',
  display_order: 0,
  image_url: '',
  image_status: '',
  image_notes: '',
  quantity: 0,
  unit: '',
  quantity_2: 0,
  uom_2: '',
  active: true,
  customer_visible: true,
  item_type: 'PRODUCT',
  operational_item: false,
  can_be_package_item: true,
  can_be_side_item: false,
  can_be_additional: true,
  can_be_option_choice: true,
  inventory_enabled: false,
  cost_price: 0,
  sale_price: 0,
}

/** @deprecated Use EMPTY_CATALOG_ITEM_ROW */
export const EMPTY_ADDITIONAL_ITEM_ROW = EMPTY_CATALOG_ITEM_ROW

export function catalogItemDraftFromListItem(
  item: Record<string, unknown>,
): CatalogItemsInsertPayload {
  return {
    item_key: String(item.item_key ?? ''),
    item_name: String(item.item_name ?? ''),
    label_pt: String(item.label_pt ?? ''),
    label_en: String(item.label_en ?? ''),
    label_es: String(item.label_es ?? ''),
    category_key: String(item.category_key ?? ''),
    category_pt: String(item.category_pt ?? ''),
    category_en: String(item.category_en ?? ''),
    category_es: String(item.category_es ?? ''),
    price: Number(item.price ?? 0),
    charge_type: String(item.charge_type ?? 'UNIT'),
    pricing_type: String(item.pricing_type ?? 'PER_UNIT'),
    unit_label: String(item.unit_label ?? 'UN'),
    currency_code: String(item.currency_code ?? 'USD'),
    display_order: Number(item.display_order ?? 0),
    image_url: String(item.image_url ?? ''),
    image_status: String(item.image_status ?? ''),
    image_notes: item.image_notes == null ? null : String(item.image_notes),
    quantity: Number(item.quantity ?? 0),
    unit: String(item.unit ?? ''),
    quantity_2: Number(item.quantity_2 ?? 0),
    uom_2: String(item.uom_2 ?? ''),
    active: item.active !== false,
    customer_visible: item.customer_visible !== false,
    item_type: String(item.item_type ?? 'PRODUCT'),
    operational_item: item.operational_item === true,
    can_be_package_item: item.can_be_package_item !== false,
    can_be_side_item: item.can_be_side_item === true,
    can_be_additional: item.can_be_additional !== false,
    can_be_option_choice: item.can_be_option_choice !== false,
    inventory_enabled: item.inventory_enabled === true,
    cost_price: Number(item.cost_price ?? 0),
    sale_price: Number(item.sale_price ?? item.price ?? 0),
  }
}

/** @deprecated Use catalogItemDraftFromListItem */
export const additionalItemDraftFromListItem = catalogItemDraftFromListItem

export function AdditionalItemAdminFormFields({
  draft,
  setDraft,
}: {
  draft: CatalogItemsInsertPayload
  setDraft: React.Dispatch<React.SetStateAction<CatalogItemsInsertPayload>>
}) {
  const locale = useAuthLocaleFromMe()
  return (
    <>
      <BackofficeFormSectionTitle>
        {tCommon(locale, 'mainData')}
      </BackofficeFormSectionTitle>
      <BackofficeField label={tCommon(locale, 'keyLabel')}>
        <BackofficeInput
          value={draft.item_key ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, item_key: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'name')}>
        <BackofficeInput
          value={draft.item_name ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, item_name: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'namePt')}>
        <BackofficeInput
          value={draft.label_pt ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, label_pt: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'nameEn')}>
        <BackofficeInput
          value={draft.label_en ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, label_en: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'nameEs')}>
        <BackofficeInput
          value={draft.label_es ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, label_es: v }))}
        />
      </BackofficeField>
      <BackofficeField label="category_key">
        <BackofficeInput
          value={draft.category_key ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, category_key: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'categoryPt')}>
        <BackofficeSelect
          value={String(draft.category_pt ?? '')}
          onChange={(v) => setDraft((c) => ({ ...c, category_pt: v }))}
        >
          <option value="">—</option>
          {ADDITIONAL_ITEM_CATEGORY_ORDER.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </BackofficeSelect>
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'categoryEn')}>
        <BackofficeInput
          value={draft.category_en ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, category_en: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'categoryEs')}>
        <BackofficeInput
          value={draft.category_es ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, category_es: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'salePrice')}>
        <BackofficeInput
          type="number"
          value={draft.sale_price ?? draft.price ?? 0}
          onChange={(v) =>
            setDraft((c) => ({
              ...c,
              sale_price: Number(v),
              price: Number(v),
            }))
          }
        />
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'costFuture')}>
        <BackofficeInput
          type="number"
          value={draft.cost_price ?? 0}
          onChange={(v) => setDraft((c) => ({ ...c, cost_price: Number(v) }))}
        />
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'chargeType')}>
        <BackofficeSelect
          value={String(draft.pricing_type ?? 'PER_UNIT')}
          onChange={(v) => setDraft((c) => ({ ...c, pricing_type: v }))}
        >
          <option value="PER_UNIT">{tPackages(locale, 'perUnitOption')}</option>
          <option value="PER_PERSON">{tPackages(locale, 'perPersonOption')}</option>
        </BackofficeSelect>
      </BackofficeField>
      <BackofficeField label="charge_type">
        <BackofficeInput
          value={draft.charge_type ?? 'UNIT'}
          onChange={(v) => setDraft((c) => ({ ...c, charge_type: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'unit')}>
        <BackofficeInput
          value={draft.unit_label ?? 'UN'}
          onChange={(v) => setDraft((c) => ({ ...c, unit_label: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'currency')}>
        <BackofficeInput
          value={draft.currency_code ?? 'USD'}
          onChange={(v) => setDraft((c) => ({ ...c, currency_code: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'displayOrder')}>
        <BackofficeInput
          type="number"
          value={draft.display_order ?? 0}
          onChange={(v) =>
            setDraft((c) => ({ ...c, display_order: Number(v) }))
          }
        />
      </BackofficeField>
      <BackofficeFormSectionTitle>
        {tPackages(locale, 'systemUsage')}
      </BackofficeFormSectionTitle>
      <BackofficeField label={tPackages(locale, 'itemType')}>
        <BackofficeSelect
          value={String(draft.item_type ?? 'PRODUCT')}
          onChange={(v) => setDraft((c) => ({ ...c, item_type: v }))}
        >
          <option value="PRODUCT">{tPackages(locale, 'typeProduct')}</option>
          <option value="PACKAGE_ITEM">{tPackages(locale, 'typePackageItem')}</option>
          <option value="SIDE">{tPackages(locale, 'typeSide')}</option>
          <option value="EQUIPMENT">{tPackages(locale, 'typeEquipment')}</option>
          <option value="SUPPLY">{tPackages(locale, 'typeSupply')}</option>
        </BackofficeSelect>
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'visibleToCustomer')}>
        <BackofficeSelect
          value={draft.customer_visible === false ? 'false' : 'true'}
          onChange={(v) =>
            setDraft((c) => ({ ...c, customer_visible: v === 'true' }))
          }
        >
          <option value="true">{tCommon(locale, 'yes')}</option>
          <option value="false">{tPackages(locale, 'notInternal')}</option>
        </BackofficeSelect>
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'operationalItem')}>
        <BackofficeSelect
          value={draft.operational_item === true ? 'true' : 'false'}
          onChange={(v) =>
            setDraft((c) => ({ ...c, operational_item: v === 'true' }))
          }
        >
          <option value="false">{tCommon(locale, 'no')}</option>
          <option value="true">{tCommon(locale, 'yes')}</option>
        </BackofficeSelect>
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'canBePackageItem')}>
        <BackofficeSelect
          value={draft.can_be_package_item === false ? 'false' : 'true'}
          onChange={(v) =>
            setDraft((c) => ({ ...c, can_be_package_item: v === 'true' }))
          }
        >
          <option value="true">{tCommon(locale, 'yes')}</option>
          <option value="false">{tCommon(locale, 'no')}</option>
        </BackofficeSelect>
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'canBeSide')}>
        <BackofficeSelect
          value={draft.can_be_side_item === true ? 'true' : 'false'}
          onChange={(v) =>
            setDraft((c) => ({ ...c, can_be_side_item: v === 'true' }))
          }
        >
          <option value="true">{tCommon(locale, 'yes')}</option>
          <option value="false">{tCommon(locale, 'no')}</option>
        </BackofficeSelect>
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'canBeAdditional')}>
        <BackofficeSelect
          value={draft.can_be_additional === false ? 'false' : 'true'}
          onChange={(v) =>
            setDraft((c) => ({ ...c, can_be_additional: v === 'true' }))
          }
        >
          <option value="true">{tCommon(locale, 'yes')}</option>
          <option value="false">{tCommon(locale, 'no')}</option>
        </BackofficeSelect>
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'canBeOption')}>
        <BackofficeSelect
          value={draft.can_be_option_choice === false ? 'false' : 'true'}
          onChange={(v) =>
            setDraft((c) => ({ ...c, can_be_option_choice: v === 'true' }))
          }
        >
          <option value="true">{tCommon(locale, 'yes')}</option>
          <option value="false">{tCommon(locale, 'no')}</option>
        </BackofficeSelect>
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'inventoryFuture')}>
        <BackofficeSelect
          value={draft.inventory_enabled === true ? 'true' : 'false'}
          onChange={(v) =>
            setDraft((c) => ({ ...c, inventory_enabled: v === 'true' }))
          }
        >
          <option value="false">{tCommon(locale, 'no')}</option>
          <option value="true">{tCommon(locale, 'yes')}</option>
        </BackofficeSelect>
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'status')}>
        <BackofficeSelect
          value={draft.active === false ? 'false' : 'true'}
          onChange={(v) => setDraft((c) => ({ ...c, active: v === 'true' }))}
        >
          <option value="true">{tCommon(locale, 'active')}</option>
          <option value="false">{tCommon(locale, 'inactive')}</option>
        </BackofficeSelect>
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'imageUrl')} className="sm:col-span-2">
        <BackofficeInput
          value={draft.image_url ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, image_url: v }))}
        />
      </BackofficeField>
      <BackofficeField label="image_status">
        <BackofficeInput
          value={draft.image_status ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, image_status: v }))}
        />
      </BackofficeField>
      <BackofficeField label="image_notes" className="sm:col-span-2">
        <BackofficeInput
          value={draft.image_notes ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, image_notes: v }))}
        />
      </BackofficeField>
      <BackofficeField label="quantity">
        <BackofficeInput
          type="number"
          value={draft.quantity ?? 0}
          onChange={(v) => setDraft((c) => ({ ...c, quantity: Number(v) }))}
        />
      </BackofficeField>
      <BackofficeField label="unit">
        <BackofficeInput
          value={draft.unit ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, unit: v }))}
        />
      </BackofficeField>
      <BackofficeField label="quantity_2">
        <BackofficeInput
          type="number"
          value={draft.quantity_2 ?? 0}
          onChange={(v) => setDraft((c) => ({ ...c, quantity_2: Number(v) }))}
        />
      </BackofficeField>
      <BackofficeField label="uom_2">
        <BackofficeInput
          value={draft.uom_2 ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, uom_2: v }))}
        />
      </BackofficeField>
    </>
  )
}
