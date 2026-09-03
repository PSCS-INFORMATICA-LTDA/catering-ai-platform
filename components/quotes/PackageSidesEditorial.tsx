'use client'

import { PACKAGE_COMMON_ITEMS } from '@/Lib/cdlCommercialRules'
import { translateCdlItemList } from '@/Lib/cdlPackageItemI18n'
import {
  getPlusGuarnicoesChoiceLabels,
  getPlusGuarnicoesFixedSideLabels,
} from '@/Lib/packageQuoteDisplay'
import type { PackageOptionGroup } from '@/Lib/packageOptionGroups'
import { tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

/**
 * Proteins/sides that every standard CDL package already carries in `items`.
 * Display-only for this black block — do not fold them into PACKAGE_COMMON_ITEMS,
 * because that constant also feeds buildDescription() and would duplicate copy.
 */
const PACKAGE_EDITORIAL_FIXED_ITEMS = [
  'Picanha Angus',
  'Frango sobrecoxa desossada',
  'Pão de alho',
  'Queijo coalho',
  'Milho',
] as const

/**
 * Tells the customer what every package already includes before they choose
 * between with and without sides — two things that were easy to confuse.
 *
 * Common accompaniments still come from the commercial rules. The five
 * editorial proteins/sides above are prepended only for this frame.
 * The price is the same `sidesPricePerPerson` the cards price with.
 *
 * PLUS composition is display-only: Farofa stays in the commercial SIDES_ITEMS
 * list but is not repeated here because it already appears under ACOMPANHAM.
 * The optional SIDE_OPTION choice uses the live group labels, never a
 * parallel array.
 */
export default function PackageSidesEditorial({
  language,
  sidesPricePerPerson,
  formatMoney,
  optionGroups = [],
}: {
  language: QuoteLanguage
  sidesPricePerPerson: number
  formatMoney: (value: number) => string
  optionGroups?: ReadonlyArray<PackageOptionGroup>
}) {
  const included = translateCdlItemList(
    [...PACKAGE_EDITORIAL_FIXED_ITEMS, ...PACKAGE_COMMON_ITEMS],
    language,
  ).map((label) =>
    language === 'pt' && label === 'Frango sobrecoxa desossada'
      ? 'Sobrecoxa sem osso'
      : label,
  )
  const fixedSides = getPlusGuarnicoesFixedSideLabels(language, optionGroups)
  const choiceLabels = getPlusGuarnicoesChoiceLabels(optionGroups, language)
  const price = formatMoney(sidesPricePerPerson)
  const upsell = tw(language, 'packageSidesUpsellText', { price })
  const priceAt = upsell.indexOf(price)
  const upsellNodes =
    priceAt >= 0
      ? [
          upsell.slice(0, priceAt),
          <span key="price" className="public-package-editorial-price">
            {price}
          </span>,
          upsell.slice(priceAt + price.length),
        ]
      : [upsell]
  const choiceLead = tw(language, 'packageSidesChoiceLead')
  const choiceOptions = choiceLabels.join(` ${tw(language, 'listOr')} `)

  return (
    <section data-package-sides-editorial className="public-package-editorial">
      <div>
        <p className="public-package-editorial-title">
          {tw(language, 'packageIncludedTitle')}
        </p>
        <p
          data-package-included-items
          className="public-package-editorial-names"
        >
          {included.join(' · ')}
        </p>
        <p className="public-package-editorial-helper">
          {tw(language, 'packageIncludedHelper')}
        </p>
      </div>
      {sidesPricePerPerson > 0 ? (
        <div className="public-package-editorial-upsell">
          <p className="public-package-editorial-title">
            {tw(language, 'packageSidesUpsellTitle')}
          </p>
          <p
            data-package-sides-upsell
            className="public-package-editorial-items"
          >
            {upsellNodes}
          </p>
          {fixedSides.length > 0 ? (
            <p
              data-package-sides-items
              className="public-package-editorial-names"
            >
              {fixedSides.join(' · ')}
            </p>
          ) : null}
          {choiceOptions ? (
            <p
              data-package-sides-choice
              className="public-package-editorial-choice"
            >
              <span className="public-package-editorial-choice-lead">
                {choiceLead}{' '}
              </span>
              <span className="public-package-editorial-choice-options">
                {choiceOptions}.
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
      <div data-included-service className="public-package-editorial-upsell">
        <p className="public-package-editorial-title">
          {tw(language, 'includedServiceTitle')}
        </p>
        <p
          data-package-sides-disposables
          data-included-service-body
          className="public-package-editorial-helper"
        >
          {tw(language, 'includedServiceBody')}
        </p>
        <p
          data-included-service-disposables-with-sides
          className="public-package-editorial-helper"
        >
          {tw(language, 'includedServiceDisposablesWithSides')}
        </p>
      </div>
    </section>
  )
}
