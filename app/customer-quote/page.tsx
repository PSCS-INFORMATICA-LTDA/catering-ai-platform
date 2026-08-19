import Link from 'next/link'
import { headers } from 'next/headers'
import CdlBrandLogo from '../../components/CdlBrandLogo'
import { PscsOneMark } from '@/components/brand/PscsOneMark'
import {
  CHILD_FREE_AGE_MAX,
  CHILD_HALF_AGE_MAX,
  GRILL_RENTAL_FEE,
  SERVICE_DURATION_HOURS,
  SIDES_PRICE_PER_PERSON,
  WAITER_SERVICE_FEE,
} from '../../Lib/cdlCommercialRules'
import { resolveBrowserLocale, tPublicOps } from '@/Lib/i18n/publicOps'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'

export default async function CustomerQuotePage() {
  const lang = resolveBrowserLocale(
    (await headers()).get('accept-language'),
  )

  const sections = [
    {
      title: tPublicOps(lang, 'sectionHowItWorks'),
      body: [
        tPublicOps(lang, 'howHours', { hours: SERVICE_DURATION_HOURS }),
        tPublicOps(lang, 'howNoDrinks'),
        tPublicOps(lang, 'howWaiter', { amount: WAITER_SERVICE_FEE }),
        tPublicOps(lang, 'howGrill', { amount: GRILL_RENTAL_FEE }),
        tPublicOps(lang, 'howChildren', {
          free: CHILD_FREE_AGE_MAX,
          half: CHILD_HALF_AGE_MAX,
        }),
      ],
    },
    {
      title: tPublicOps(lang, 'sectionChoosePackage'),
      body: [tPublicOps(lang, 'eventDataBody')],
    },
    {
      title: tPublicOps(lang, 'sectionSides'),
      body: [
        tPublicOps(lang, 'sidesExtra', { amount: SIDES_PRICE_PER_PERSON }),
      ],
    },
    {
      title: tPublicOps(lang, 'sectionExtras'),
      body: [
        tPublicOps(lang, 'extrasBody1'),
        tPublicOps(lang, 'extrasBody2'),
      ],
    },
    {
      title: tPublicOps(lang, 'sectionEventData'),
      body: [tPublicOps(lang, 'eventDataBody')],
    },
    {
      title: tPublicOps(lang, 'sectionGrill'),
      body: [
        tPublicOps(lang, 'grillBody'),
        tPublicOps(lang, 'grillRentalLine', { amount: GRILL_RENTAL_FEE }),
      ],
    },
    {
      title: tPublicOps(lang, 'sectionMileage'),
      body: [
        tQuotesOrders(lang, 'ruleMileageBase', { base: 'Orlando Eye' }),
        tQuotesOrders(lang, 'ruleMileageFree', { limit: 20, unit: 'mi' }),
        tQuotesOrders(lang, 'ruleMileageRate', { rate: 2, unit: 'mi' }),
      ],
    },
    {
      title: tPublicOps(lang, 'sectionDeposit'),
      body: [tQuotesOrders(lang, 'docReservationPaymentText')],
    },
    {
      title: tPublicOps(lang, 'sectionRules'),
      body: [
        tQuotesOrders(lang, 'ruleMinWeekday', { amount: 800 }),
        tQuotesOrders(lang, 'ruleMinWeekend', { amount: 1000 }),
        tQuotesOrders(lang, 'ruleFoodStorage'),
        tQuotesOrders(lang, 'ruleLatePayment', { amount: 100 }),
      ],
    },
    {
      title: tPublicOps(lang, 'sectionHoliday'),
      body: [
        tQuotesOrders(lang, 'ruleDecJanMin', { amount: 900 }),
        tQuotesOrders(lang, 'ruleHolidaySurcharge', { pct: 100, min: 2000 }),
      ],
    },
    {
      title: tPublicOps(lang, 'sectionCancel'),
      body: [
        tQuotesOrders(lang, 'cancelPolicy1'),
        tQuotesOrders(lang, 'cancelPolicy2'),
      ],
    },
    {
      title: tPublicOps(lang, 'sectionStart'),
      body: [tPublicOps(lang, 'startQuoteBody')],
    },
  ]

  return (
    <main className="min-h-screen bg-cdl-bg text-cdl-fg">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-10 text-center">
          <div className="mb-6 flex justify-center">
            <CdlBrandLogo className="h-20 w-20 sm:h-24 sm:w-24" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cdl-muted">
            {tPublicOps(lang, 'customerQuoteEyebrow')}
          </p>
          <h1 className="mt-3 text-3xl font-black text-cdl-title sm:text-4xl">
            {tPublicOps(lang, 'customerQuoteTitle')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-cdl-text-secondary sm:text-base">
            {tPublicOps(lang, 'customerQuoteIntro')}
          </p>
        </header>

        <div className="space-y-5">
          {sections.map((section, index) => (
            <section
              key={section.title}
              className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl sm:p-8"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cdl-accent text-sm font-black text-cdl-on-accent">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-cdl-title sm:text-xl">
                    {section.title}
                  </h2>
                  <ul className="mt-4 space-y-2 text-sm text-cdl-text-secondary sm:text-base">
                    {section.body.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="text-cdl-title" aria-hidden>
                          •
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href="/quotes/new" className="cdl-btn-primary w-full sm:w-auto">
            {tPublicOps(lang, 'startMyQuote')}
          </Link>
          <Link
            href="/"
            className="w-full rounded-xl border border-cdl-border bg-cdl-surface px-6 py-3 text-center text-sm font-bold uppercase tracking-wider text-cdl-fg transition-colors hover:border-cdl-accent-border sm:w-auto"
          >
            {tPublicOps(lang, 'backHome')}
          </Link>
        </div>
        <footer className="mt-12 flex flex-col items-center gap-2 border-t border-cdl-border pt-6">
          <PscsOneMark />
        </footer>
      </div>
    </main>
  )
}
