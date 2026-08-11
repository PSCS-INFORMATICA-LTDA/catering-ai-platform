import { fetchQuoteForEdit } from '@/Lib/fetchQuoteForEdit'
import { mapQuoteDetailToWizardState } from '@/Lib/mapQuoteToWizard'
import QuoteWizard from '../../new/QuoteWizard'
import { getAuthSession } from '@/Lib/auth/session'
import { resolveAuthLocale } from '@/Lib/i18n/authUsers'
import { tw } from '@/Lib/quoteTranslations'

export default async function EditQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ step?: string }>
}) {
  const { id } = await params
  const { step } = await searchParams
  const { resolveWizardStep, EDIT_WIZARD_DEFAULT_STEP } = await import(
    '@/Lib/wizardStepNavigation'
  )
  const initialStep = resolveWizardStep(step, EDIT_WIZARD_DEFAULT_STEP)
  const session = await getAuthSession()
  const locale = resolveAuthLocale(session?.appUser?.preferred_language)
  const {
    quote,
    linkedCustomer,
    packages,
    catalogItems,
    packageOptionGroups,
    packageOptionGroupItems,
    packageItems,
    packageSideItems,
    commercialRules,
    fetchErrors,
    error,
  } = await fetchQuoteForEdit(id, locale)

  if (error || !quote) {
    return (
      <main className="min-h-screen bg-cdl-bg p-6 text-cdl-fg sm:p-10">
        <h1 className="text-2xl font-bold text-cdl-title">
          {tw(locale, 'loadQuoteError')}
        </h1>
        <pre className="mt-4 rounded-2xl border border-cdl-border bg-cdl-surface p-4 text-sm text-red-400">
          {error?.message ?? tw(locale, 'quoteNotFound')}
        </pre>
      </main>
    )
  }

  const { state, pricingFingerprint } = mapQuoteDetailToWizardState(
    quote,
    commercialRules,
  )

  return (
    <QuoteWizard
      mode="edit"
      quoteId={id}
      initialStep={initialStep}
      initialState={state}
      initialPricingFingerprint={pricingFingerprint}
      existingSnapshot={quote}
      linkedCustomer={linkedCustomer}
      customers={[]}
      packages={packages}
      catalogItems={catalogItems}
      packageOptionGroups={packageOptionGroups}
      packageOptionGroupItems={packageOptionGroupItems}
      packageItems={packageItems}
      packageSideItems={packageSideItems}
      commercialRules={commercialRules}
      fetchErrors={fetchErrors}
    />
  )
}
