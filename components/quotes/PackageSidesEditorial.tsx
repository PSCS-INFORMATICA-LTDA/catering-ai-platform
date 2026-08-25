'use client'

import { PACKAGE_COMMON_ITEMS } from '@/Lib/cdlCommercialRules'
import { translateCdlItemList } from '@/Lib/cdlPackageItemI18n'
import {
  getPresentedPlusSideLabels,
  plusGuarnicoesHasCaesarChoice,
  toPublicSidesDisplayLabel,
} from '@/Lib/packageQuoteDisplay'
import type { PackageOptionGroup } from '@/Lib/packageOptionGroups'
import { tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

/**
 * Tells the customer what every package already includes — and which four
 * sides the COM GUARNIÇÕES arts present — before they choose between with
 * and without sides.
 *
 * The four presented names are display-only. SIDES_ITEMS, SIDE_OPTION and
 * sidesPricePerPerson stay the commercial source; Caesar remains a live
 * option group, shown here only as optional text, never inside the photos.
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
  const included = translateCdlItemList([...PACKAGE_COMMON_ITEMS], language).map(
    (label) => toPublicSidesDisplayLabel(label, language),
  )
  const presentedSides = getPresentedPlusSideLabels(language)
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
  return (
    <section
      data-package-sides-editorial
      data-side-option-live={
        plusGuarnicoesHasCaesarChoice(optionGroups) ? 'caesar' : 'none'
      }
      className="public-package-editorial"
    >
      <div
        data-package-presented-sides
        className="public-package-presented-sides"
      >
        <p className="public-package-presented-badge">
          {tw(language, 'withSidesGroupTitle')}
        </p>
        <p className="public-package-presented-headline">
          {tw(language, 'packagePresentedSidesHeadline')}
        </p>
        <p className="public-package-presented-support">
          {tw(language, 'packagePresentedSidesSupport')}
        </p>
        <p className="public-package-editorial-title">
          {tw(language, 'packagePresentedSidesTitle')}
        </p>
        <p
          data-package-sides-items
          className="public-package-editorial-names public-package-presented-names"
        >
          {presentedSides.join(' · ')}
        </p>
        <p
          data-package-sides-choice
          className="public-package-editorial-choice"
        >
          <span className="public-package-editorial-choice-lead">
            {tw(language, 'packageSidesOptionalNote')}
          </span>
        </p>
        {sidesPricePerPerson > 0 ? (
          <p
            data-package-sides-upsell
            className="public-package-editorial-items"
          >
            <span className="public-package-presented-kicker">
              {tw(language, 'packageSidesUpsellTitle')}
            </span>
            {upsellNodes}
          </p>
        ) : null}
        <p className="public-package-presented-footer">
          {tw(language, 'packagePresentedSidesFooter')}
        </p>
      </div>
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
    </section>
  )
}
