'use client'

import {
  PAYMENT_HELP_REVIEWED_AT,
  paymentHelpLabels,
  paymentHelpSections,
  paymentHelpText,
  type PaymentHelpTopic,
} from '@/Lib/payments/paymentSetupHelp'

/** Read-only native disclosure: keyboard/touch accessible and no provider requests. */
export default function PaymentSetupHelp({
  locale,
  topic = 'all',
}: {
  locale: string
  topic?: PaymentHelpTopic | 'all'
}) {
  const topics = topic === 'all'
    ? Object.keys(paymentHelpSections) as PaymentHelpTopic[]
    : [topic]
  const title = paymentHelpText(locale, topic === 'all'
    ? paymentHelpLabels.title
    : paymentHelpSections[topic].title)
  return (
    <details data-payment-setup-help={topic} className="min-w-0 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-700">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 font-semibold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
        <span aria-hidden="true" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current">?</span>
        <span>{title}</span>
      </summary>
      <div className="space-y-4 border-t border-neutral-100 px-4 py-4 leading-relaxed">
        {topic === 'all' ? <p className="rounded-lg bg-amber-50 p-3 text-amber-900">{paymentHelpText(locale, paymentHelpLabels.warning)}</p> : null}
        {topics.map((key) => {
          const section = paymentHelpSections[key]
          return (
            <section key={key} data-payment-help-topic={key} className="min-w-0">
              {topic === 'all' ? <h3 className="mb-2 font-bold text-neutral-900">{paymentHelpText(locale, section.title)}</h3> : null}
              <ol className="list-decimal space-y-2 pl-5">
                {section.steps.map((step, index) => <li key={index}>{paymentHelpText(locale, step)}</li>)}
              </ol>
              {section.links.length ? (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold">{paymentHelpText(locale, paymentHelpLabels.sources)}</p>
                  {section.links.map((href) => (
                    <a key={href} href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="block break-all py-1 text-xs text-red-700 underline focus-visible:outline focus-visible:outline-2">
                      {href}
                    </a>
                  ))}
                </div>
              ) : null}
            </section>
          )
        })}
        <p className="text-xs text-neutral-500">{paymentHelpText(locale, paymentHelpLabels.reviewed)}: {PAYMENT_HELP_REVIEWED_AT}</p>
      </div>
    </details>
  )
}
