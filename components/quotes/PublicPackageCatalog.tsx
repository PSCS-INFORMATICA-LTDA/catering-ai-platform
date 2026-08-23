'use client'

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  findBasePackage,
  formatPackageCatalogPriceLabel,
  getPackageCatalogImage,
  getPackageCatalogName,
  getPackageCatalogPrice,
  getPackageCatalogVariant,
  getPackagePriceLineLabel,
  getPublicPackageSidesGroup,
  isPackageCatalogPriceOnRequest,
  resolvePackageSidesPricing,
  type PackageCatalogFields,
} from '@/Lib/packageCatalogVisual'
import type { PackageOptionGroup } from '@/Lib/packageOptionGroups'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'
import PackageIncludedOptions from '@/components/quotes/PackageIncludedOptions'
import PackageCatalogHeroArt from '@/components/quotes/PackageCatalogHeroArt'

type PackageSidesGroup = 'with_sides' | 'without_sides'

type PublicPackageCard = PackageCatalogFields & {
  id: string
  package_key?: string | null
}

function PackageExperienceBody({
  language,
  text,
}: {
  language: QuoteLanguage
  text: string
}) {
  const marks =
    language === 'en'
      ? [
          'with or without sides',
          'Explore the packages',
          'Pricing updates as you go.',
        ]
      : language === 'es'
        ? [
            'con o sin acompañamientos',
            'Explora los paquetes',
            'El precio se actualiza al momento.',
          ]
        : [
            'com ou sem guarnições',
            'Explore os pacotes',
            'O valor atualiza na hora.',
          ]
  const nodes: ReactNode[] = []
  let remaining = text
  let key = 0
  for (const mark of marks) {
    const index = remaining.toLowerCase().indexOf(mark.toLowerCase())
    if (index < 0) continue
    if (index > 0) {
      nodes.push(<span key={key++}>{remaining.slice(0, index)}</span>)
    }
    nodes.push(
      <strong key={key++} className="font-black text-cdl-title">
        {remaining.slice(index, index + mark.length)}
      </strong>,
    )
    remaining = remaining.slice(index + mark.length)
  }
  if (remaining) nodes.push(<span key={key++}>{remaining}</span>)
  return (
    <p className="mt-3 text-sm leading-relaxed text-cdl-muted">{nodes}</p>
  )
}

const PACKAGE_EDITORIAL_HEADLINE = {
  pt: 'PACOTES CDL',
  en: 'CDL PACKAGES',
  es: 'PAQUETES CDL',
} as const

function PackageGroupChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.58l3.3-3.28a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.42z"
      />
    </svg>
  )
}

function formatMoney(
  value: number,
  language: QuoteLanguage,
  currency: string,
): string {
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-US' : 'pt-BR'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function perPersonSuffix(language: QuoteLanguage): string {
  if (language === 'en') return 'person'
  if (language === 'es') return 'persona'
  return 'pessoa'
}

function PackageGroupToggle({
  title,
  expanded,
  group,
  selected,
  onClick,
}: {
  title: string
  expanded: boolean
  group: PackageSidesGroup
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-package-group={group}
      data-package-group-toggle={group}
      data-package-group-open={expanded ? 'true' : 'false'}
      aria-expanded={expanded}
      onClick={onClick}
      className={`public-package-group ${expanded ? 'is-open' : ''}`}
    >
      <span className="public-package-group-copy">
        {expanded ? <span className="public-package-group-accent" aria-hidden /> : null}
        <span className="public-package-group-label">{title}</span>
      </span>
      {selected ? (
        <span
          data-package-group-selected
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
          aria-hidden
        />
      ) : null}
      <PackageGroupChevron open={expanded} />
    </button>
  )
}

function PackageCatalogCard({
  pkg,
  allPackages,
  active,
  language,
  sidesPricePerPerson,
  onClick,
}: {
  pkg: PublicPackageCard
  allPackages: readonly PublicPackageCard[]
  active: boolean
  language: QuoteLanguage
  sidesPricePerPerson: number
  onClick: () => void
}) {
  const name = getPackageCatalogName(pkg, language)
  const image = getPackageCatalogImage(pkg, allPackages)
  const variant = getPackageCatalogVariant(pkg)
  const selectedLabel = getQuoteStrings(language).selected
  const currency = pkg.currency_code?.trim() || 'USD'
  const money = (value: number) => formatMoney(value, language, currency)
  const perPerson = perPersonSuffix(language)
  const priceOnRequest = isPackageCatalogPriceOnRequest(pkg)
  const basePackage = findBasePackage(pkg, allPackages)
  const sidesPricing =
    variant === 'with_sides'
      ? resolvePackageSidesPricing(pkg, basePackage, sidesPricePerPerson)
      : null
  const packagePrice = getPackageCatalogPrice(pkg)
  const displayTotal = sidesPricing?.totalPerPerson ?? packagePrice
  const showGarnishLine =
    sidesPricing?.mode === 'breakdown' &&
    sidesPricing.basePricePerPerson != null &&
    sidesPricing.sidesPricePerPerson > 0

  return (
    <button
      type="button"
      aria-pressed={active}
      data-package-key={pkg.package_key ?? ''}
      data-package-sides-group={getPublicPackageSidesGroup(pkg)}
      onClick={onClick}
      className={`public-package-card flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-cdl-surface text-left transition ${
        active
          ? 'is-selected border-[#e21b1b]'
          : 'border-cdl-border hover:border-neutral-300'
      }`}
    >
      <span className="relative block w-full min-w-0">
        <PackageCatalogHeroArt name={name} image={image} />
        {active ? (
          <span data-package-selected-badge className="public-package-selected-badge">
            ✓ {selectedLabel}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-base font-black leading-tight text-cdl-title sm:text-lg">
          {name}
        </span>
        {priceOnRequest ? (
          <span className="text-sm font-semibold text-[var(--brand-primary)] sm:text-base">
            {formatPackageCatalogPriceLabel(pkg, language, money)}
          </span>
        ) : displayTotal > 0 ? (
          <span
            data-package-price-breakdown
            className="mt-1 min-w-0 space-y-0.5 text-sm leading-snug"
          >
            <span className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="text-cdl-muted">
                {getPackagePriceLineLabel('package', language)}
              </span>
              <span className="min-w-0 break-words text-right font-semibold tabular-nums text-cdl-title">
                <span className="public-package-price-unit">
                  {money(showGarnishLine ? sidesPricing.basePricePerPerson! : packagePrice)}{' '}
                  / {perPerson}
                </span>
              </span>
            </span>
            {showGarnishLine ? (
              <span className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="text-cdl-muted">
                  {getPackagePriceLineLabel('sides', language)}
                </span>
                <span className="min-w-0 break-words text-right font-semibold tabular-nums text-cdl-title">
                  <span className="public-package-price-unit">
                    {money(sidesPricing.sidesPricePerPerson)} / {perPerson}
                  </span>
                </span>
              </span>
            ) : null}
            <span className="flex min-w-0 items-baseline justify-between gap-3 pt-1">
              <span className="font-black text-[var(--brand-primary)]">
                {getPackagePriceLineLabel('total', language)}
              </span>
              <span
                data-package-display-total
                className="min-w-0 break-words text-right text-base font-black tabular-nums text-[var(--brand-primary)]"
              >
                <span className="public-package-price-unit">
                  {money(displayTotal)} / {perPerson}
                </span>
              </span>
            </span>
          </span>
        ) : null}
      </span>
    </button>
  )
}

export default function PublicPackageCatalog({
  packagesWithoutSides,
  packagesWithSides,
  allPackages,
  selectedPackageId,
  language = 'pt',
  sidesPricePerPerson,
  optionGroupsForPackage,
  selections,
  onSelectionChange,
  pendingSelectionGroupIds,
  onSelect,
}: {
  packagesWithoutSides: PublicPackageCard[]
  packagesWithSides: PublicPackageCard[]
  allPackages: PublicPackageCard[]
  selectedPackageId: string | null
  language?: QuoteLanguage
  sidesPricePerPerson: number
  optionGroupsForPackage: (packageId: string) => PackageOptionGroup[]
  selections: Record<string, string>
  onSelectionChange: (groupId: string, itemId: string) => void
  pendingSelectionGroupIds: string[]
  onSelect: (id: string) => void
}) {
  const t = getQuoteStrings(language)
  const optionsRef = useRef<HTMLDivElement>(null)
  const [openGroup, setOpenGroup] = useState<PackageSidesGroup | null>(() => {
    if (!selectedPackageId) return null
    const selected = allPackages.find((pkg) => pkg.id === selectedPackageId)
    return selected ? getPublicPackageSidesGroup(selected) : null
  })

  useEffect(() => {
    if (!selectedPackageId) return
    const node = optionsRef.current
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedPackageId, openGroup])

  function renderGroup(packages: PublicPackageCard[]) {
    return (
      <div className="mt-4 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {packages.map((pkg) => {
          const active = selectedPackageId === pkg.id
          const selectableGroups = active
            ? optionGroupsForPackage(pkg.id).filter(
                (group) => group.items.length > 0,
              )
            : []

          return (
            <Fragment key={pkg.id}>
              <PackageCatalogCard
                pkg={pkg}
                allPackages={allPackages}
                active={active}
                language={language}
                sidesPricePerPerson={sidesPricePerPerson}
                onClick={() => onSelect(pkg.id)}
              />
              {active && selectableGroups.length > 0 ? (
                <div
                  ref={optionsRef}
                  data-public-package-options
                  className="min-w-0 lg:col-span-2"
                >
                  <section className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--brand-primary-2)_35%,transparent)] bg-cdl-surface p-4 sm:p-5">
                    <h3 className="text-sm font-black uppercase tracking-wide text-cdl-title">
                      {t.wizard.publicPackageOptionsTitle}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-cdl-title">
                      {getPackageCatalogName(pkg, language)}
                    </p>
                    <div className="mt-4 min-w-0">
                      <PackageIncludedOptions
                        optionGroups={selectableGroups}
                        selections={selections}
                        onChange={onSelectionChange}
                        language={language}
                        pendingGroupIds={pendingSelectionGroupIds}
                      />
                    </div>
                  </section>
                </div>
              ) : null}
            </Fragment>
          )
        })}
      </div>
    )
  }

  if (packagesWithSides.length === 0 && packagesWithoutSides.length === 0) {
    return <p className="text-sm text-cdl-muted">{tw(language, 'noPackages')}</p>
  }

  return (
    <div className="min-w-0 space-y-6">
      <section
        className="public-package-intro"
        data-package-experience-intro
      >
        <p className="public-package-kicker">
          {tw(language, 'publicPackageExperienceTitle')}
        </p>
        <h2 className="public-package-headline">
          <span className="public-package-headline-mark">
            {PACKAGE_EDITORIAL_HEADLINE[language]}
          </span>
        </h2>
        <PackageExperienceBody
          language={language}
          text={tw(language, 'publicPackageExperienceBody')}
        />
      </section>
      <div
        data-package-group-controls
        className="public-package-groups"
      >
        {packagesWithSides.length > 0 ? (
          <PackageGroupToggle
            group="with_sides"
            title={tw(language, 'withSidesGroupTitle')}
            selected={packagesWithSides.some((pkg) => pkg.id === selectedPackageId)}
            expanded={openGroup === 'with_sides'}
            onClick={() =>
              setOpenGroup((current) =>
                current === 'with_sides' ? null : 'with_sides',
              )
            }
          />
        ) : null}
        {packagesWithoutSides.length > 0 ? (
          <PackageGroupToggle
            group="without_sides"
            title={tw(language, 'withoutSidesGroupTitle')}
            selected={packagesWithoutSides.some(
              (pkg) => pkg.id === selectedPackageId,
            )}
            expanded={openGroup === 'without_sides'}
            onClick={() =>
              setOpenGroup((current) =>
                current === 'without_sides' ? null : 'without_sides',
              )
            }
          />
        ) : null}
      </div>
      {openGroup === 'with_sides' ? (
        <section className="min-w-0">{renderGroup(packagesWithSides)}</section>
      ) : null}
      {openGroup === 'without_sides' ? (
        <section className="min-w-0">
          {renderGroup(packagesWithoutSides)}
        </section>
      ) : null}
    </div>
  )
}
