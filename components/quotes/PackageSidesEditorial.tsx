'use client'

import {
  PACKAGE_COMMON_ITEMS,
  SIDES_ITEMS,
} from '@/Lib/cdlCommercialRules'
import { translateCdlItemList } from '@/Lib/cdlPackageItemI18n'
import { tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

/**
 * Tells the customer what every package already includes before they choose
 * between with and without sides — two things that were easy to confuse.
 *
 * Both lists come from the commercial rules, and the price is the same
 * `sidesPricePerPerson` the cards price with, so nothing here can drift from
 * what is actually charged.
 */
export default function PackageSidesEditorial({
  language,
  sidesPricePerPerson,
  formatMoney,
}: {
  language: QuoteLanguage
  sidesPricePerPerson: number
  formatMoney: (value: number) => string
}) {
  const included = translateCdlItemList([...PACKAGE_COMMON_ITEMS], language)
  const sides = translateCdlItemList([...SIDES_ITEMS], language)
  const upsell = tw(language, 'packageSidesUpsellText', {
    price: formatMoney(sidesPricePerPerson),
  })

  return (
    <section data-package-sides-editorial className="public-package-editorial">
      <div>
        <p className="public-package-editorial-title">
          {tw(language, 'packageIncludedTitle')}
        </p>
        <p data-package-included-items className="public-package-editorial-items">
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
          <p data-package-sides-upsell className="public-package-editorial-items">
            {upsell}
          </p>
          <p data-package-sides-items className="public-package-editorial-helper">
            {sides.join(' · ')}
          </p>
        </div>
      ) : null}
    </section>
  )
}
