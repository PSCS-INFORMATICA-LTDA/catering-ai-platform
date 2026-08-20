import Link from 'next/link'
import { headers } from 'next/headers'
import { resolveBrowserLocale, tPublicOps } from '@/Lib/i18n/publicOps'

export const dynamic = 'force-dynamic'

/**
 * Placeholder para fluxo público de solicitação de cotação.
 * TODO: integrar com resolve-by-phone, wizard simplificado e i18n PT/EN/ES.
 */
export default async function QuoteRequestPage() {
  const lang = resolveBrowserLocale(
    (await headers()).get('accept-language'),
  )

  return (
    <main className="min-h-screen bg-cdl-bg px-4 py-8 text-cdl-fg sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-black text-cdl-title sm:text-3xl">
            {tPublicOps(lang, 'quoteRequestTitle')}
          </h1>
          <p className="mt-2 text-sm text-cdl-muted">
            {tPublicOps(lang, 'quoteRequestSubtitle')}
          </p>
        </header>

        <section className="cdl-panel space-y-4 p-6">
          <p className="text-sm text-cdl-muted">
            {tPublicOps(lang, 'quoteRequestPlanned')}
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-cdl-muted">
            <li>{tPublicOps(lang, 'quoteRequestItemLang')}</li>
            <li>{tPublicOps(lang, 'quoteRequestItemPhone')}</li>
            <li>{tPublicOps(lang, 'quoteRequestItemEvent')}</li>
            <li>{tPublicOps(lang, 'quoteRequestItemNext')}</li>
          </ul>
          <p className="text-xs italic text-cdl-muted">
            {tPublicOps(lang, 'quoteRequestTodo')}
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/quotes/new"
            className="cdl-btn-primary inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-3 text-sm font-bold"
          >
            {tPublicOps(lang, 'newQuoteStaff')}
          </Link>
          <Link
            href="/customer-quote"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-cdl-border bg-cdl-surface px-5 py-3 text-sm font-bold text-cdl-fg"
          >
            {tPublicOps(lang, 'viewCustomerPage')}
          </Link>
        </div>
      </div>
    </main>
  )
}
