'use client'

import {
  BackofficeField,
  BackofficeInput,
  BackofficeSelect,
} from '@/components/backoffice/BackofficeCardPrimitives'
import {
  BackofficeFormSectionTitle,
  BackofficeTextarea,
} from '@/components/backoffice/BackofficeSectionPrimitives'
import { tCommon } from '@/Lib/i18n/common'
import { tPackages } from '@/Lib/i18n/packages'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { getPackageDescription, type PackageFieldSource } from '@/Lib/packageFieldAccess'
import type { PackagesInsertPayload } from '@/Lib/packagesTableSchema'

export const EMPTY_PACKAGE_ROW: PackagesInsertPayload = {
  package_key: '',
  package_name: '',
  label_pt: '',
  label_en: '',
  label_es: '',
  description: '',
  description_pt: '',
  description_en: '',
  description_es: '',
  price_per_person: 0,
  currency_code: 'USD',
  display_order: 0,
  image_url: '',
  image_status: '',
  image_notes: '',
  package_highlights_pt: '',
  package_highlights_en: '',
  package_highlights_es: '',
  active: true,
}

export function packageDraftFromListItem(
  pkg: Record<string, unknown>,
): PackagesInsertPayload {
  const source = pkg as PackageFieldSource
  return {
    package_key: String(pkg.package_key ?? ''),
    package_name: String(pkg.package_name ?? ''),
    label_pt: String(pkg.label_pt ?? ''),
    label_en: String(pkg.label_en ?? ''),
    label_es: String(pkg.label_es ?? ''),
    description: String(pkg.description ?? ''),
    description_pt: String(pkg.description_pt ?? '') || getPackageDescription(source),
    description_en: String(pkg.description_en ?? ''),
    description_es: String(pkg.description_es ?? ''),
    price_per_person: Number(pkg.price_per_person ?? 0),
    currency_code: String(pkg.currency_code ?? 'USD'),
    display_order: Number(pkg.display_order ?? 0),
    image_url: String(pkg.image_url ?? ''),
    image_status: String(pkg.image_status ?? ''),
    image_notes: pkg.image_notes == null ? null : String(pkg.image_notes),
    package_highlights_pt: String(pkg.package_highlights_pt ?? ''),
    package_highlights_en: String(pkg.package_highlights_en ?? ''),
    package_highlights_es: String(pkg.package_highlights_es ?? ''),
    active: pkg.active !== false,
  }
}

export function PackageAdminFormFields({
  draft,
  setDraft,
}: {
  draft: PackagesInsertPayload
  setDraft: React.Dispatch<React.SetStateAction<PackagesInsertPayload>>
}) {
  const locale = useAuthLocaleFromMe()
  return (
    <>
      <BackofficeFormSectionTitle>
        {tCommon(locale, 'mainData')}
      </BackofficeFormSectionTitle>
      <BackofficeField label={tCommon(locale, 'code')}>
        <BackofficeInput
          value={draft.package_key ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, package_key: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'name')}>
        <BackofficeInput
          value={draft.package_name ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, package_name: v }))}
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
      <BackofficeField label={tPackages(locale, 'pricePerPersonLabel')}>
        <BackofficeInput
          type="number"
          value={draft.price_per_person ?? 0}
          onChange={(v) =>
            setDraft((c) => ({ ...c, price_per_person: Number(v) }))
          }
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

      <BackofficeFormSectionTitle>
        {tPackages(locale, 'descriptions')}
      </BackofficeFormSectionTitle>
      <BackofficeField label="description" className="sm:col-span-2 lg:col-span-3">
        <BackofficeTextarea
          value={draft.description ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, description: v }))}
          rows={3}
        />
      </BackofficeField>
      <BackofficeField label="description_pt" className="sm:col-span-2 lg:col-span-3">
        <BackofficeTextarea
          value={draft.description_pt ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, description_pt: v }))}
          rows={3}
        />
      </BackofficeField>
      <BackofficeField label="description_en" className="sm:col-span-2">
        <BackofficeTextarea
          value={draft.description_en ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, description_en: v }))}
        />
      </BackofficeField>
      <BackofficeField label="description_es" className="sm:col-span-2">
        <BackofficeTextarea
          value={draft.description_es ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, description_es: v }))}
        />
      </BackofficeField>

      <BackofficeFormSectionTitle>
        {tPackages(locale, 'commercialHighlights')}
      </BackofficeFormSectionTitle>
      <BackofficeField label={tPackages(locale, 'highlightsPt')} className="sm:col-span-2 lg:col-span-3">
        <BackofficeTextarea
          value={String(draft.package_highlights_pt ?? '')}
          onChange={(v) => setDraft((c) => ({ ...c, package_highlights_pt: v }))}
          rows={3}
        />
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'highlightsEn')} className="sm:col-span-2">
        <BackofficeTextarea
          value={String(draft.package_highlights_en ?? '')}
          onChange={(v) => setDraft((c) => ({ ...c, package_highlights_en: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tPackages(locale, 'highlightsEs')} className="sm:col-span-2">
        <BackofficeTextarea
          value={String(draft.package_highlights_es ?? '')}
          onChange={(v) => setDraft((c) => ({ ...c, package_highlights_es: v }))}
        />
      </BackofficeField>
    </>
  )
}
