'use client'

import { BackofficeSelect } from '@/components/backoffice/BackofficeCardPrimitives'
import {
  getAdditionalItemCategoryLabel,
  getAdditionalItemLabel,
} from '@/Lib/additionalItemFieldAccess'
import { getAdditionalItemPrice } from '@/Lib/getAdditionalItemPrice'
import { tCommon } from '@/Lib/i18n/common'
import { tPackages } from '@/Lib/i18n/packages'
import { toBcp47Locale } from '@/Lib/i18n/locales'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

export type AdditionalItemOption = {
  id: string
  item_key?: string | null
  item_name?: string | null
  label_pt?: string | null
  label_en?: string | null
  label_es?: string | null
  category_pt?: string | null
  category_en?: string | null
  category_es?: string | null
  image_url?: string | null
  item_type?: string | null
  price?: number | null
  sale_price?: number | null
  can_be_package_item?: boolean | null
  can_be_side_item?: boolean | null
  can_be_additional?: boolean | null
  can_be_option_choice?: boolean | null
}

/** @deprecated Use AdditionalItemOption — alias semântico para o catálogo mestre. */
export type CatalogItemOption = AdditionalItemOption

function formatPickerLabel(
  item: AdditionalItemOption,
  locale: string,
  othersLabel: string,
): string {
  const name = getAdditionalItemLabel(item, locale)
  const category =
    getAdditionalItemCategoryLabel(item, locale).trim() || othersLabel
  const price = getAdditionalItemPrice(item)
  return `${name} — ${category} — $${price.toFixed(2)}`
}

export default function AdditionalItemPicker({
  catalogItems,
  additionalItems,
  value,
  onChange,
  placeholder,
}: {
  catalogItems?: ReadonlyArray<AdditionalItemOption>
  /** @deprecated Use catalogItems */
  additionalItems?: ReadonlyArray<AdditionalItemOption>
  value: string
  onChange: (catalogItemId: string, item: AdditionalItemOption | null) => void
  placeholder?: string
}) {
  const locale = useAuthLocaleFromMe()
  const items = catalogItems ?? additionalItems ?? []
  const othersLabel = tCommon(locale, 'others')
  const resolvedPlaceholder =
    placeholder ?? tPackages(locale, 'pickCatalogItem')
  const collator = toBcp47Locale(locale)

  const sorted = [...items].sort((a, b) => {
    const cat = getAdditionalItemCategoryLabel(a, locale).localeCompare(
      getAdditionalItemCategoryLabel(b, locale),
      collator,
    )
    if (cat !== 0) return cat
    return getAdditionalItemLabel(a, locale).localeCompare(
      getAdditionalItemLabel(b, locale),
      collator,
    )
  })

  return (
    <BackofficeSelect
      value={value}
      onChange={(nextId) => {
        const item = sorted.find((row) => row.id === nextId) ?? null
        onChange(nextId, item)
      }}
    >
      <option value="">{resolvedPlaceholder}</option>
      {sorted.map((item) => (
        <option key={item.id} value={item.id}>
          {formatPickerLabel(item, locale, othersLabel)}
        </option>
      ))}
    </BackofficeSelect>
  )
}
