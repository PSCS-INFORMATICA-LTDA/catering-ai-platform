import {
  IMPORTANT_RULES,
  RESERVATION_PAYMENT_TEXT,
} from '../Lib/cdlCommercialRules'
import { emphasizeRuleText } from '../Lib/emphasizeRuleText'

type RulesVariant = 'summary' | 'pdf'

function RulesBlock({
  title,
  items,
  variant,
}: {
  title: string
  items: readonly string[]
  variant: RulesVariant
}) {
  if (items.length === 0) return null

  if (variant === 'pdf') {
    return (
      <div className="quote-proposal-rules-block">
        <h3 className="quote-proposal-rules-subtitle">{title}</h3>
        <ul className="quote-proposal-rules-list">
          {items.map((item) => (
            <li key={item}>{emphasizeRuleText(item)}</li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-cdl-border bg-cdl-inset p-4 sm:p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-cdl-title">
        {title}
      </h3>
      <ul className="mt-3 space-y-2 text-sm text-cdl-text-secondary">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-cdl-title" aria-hidden>
              •
            </span>
            <span>{emphasizeRuleText(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CdlImportantRulesPanel({
  variant = 'summary',
  showReservationText = false,
}: {
  variant?: RulesVariant
  showReservationText?: boolean
}) {
  const wrapperClass =
    variant === 'pdf'
      ? 'quote-proposal-rules quote-print-section quote-print-keep'
      : 'rounded-2xl border border-cdl-border bg-cdl-surface p-7 shadow-cdl sm:p-9'

  const titleClass =
    variant === 'pdf'
      ? 'quote-proposal-section-title'
      : 'cdl-section-title-lg'

  return (
    <section className={wrapperClass}>
      <h2 className={titleClass}>Regras importantes</h2>
      {showReservationText && variant === 'summary' && (
        <p className="mt-4 text-sm leading-relaxed text-cdl-text-secondary">
          {emphasizeRuleText(RESERVATION_PAYMENT_TEXT)}
        </p>
      )}
      <div
        className={
          variant === 'pdf'
            ? 'quote-proposal-rules-grid'
            : 'mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2'
        }
      >
        <RulesBlock
          title="Pedido mínimo"
          items={IMPORTANT_RULES.minimumOrder}
          variant={variant}
        />
        <RulesBlock
          title="Milhagem"
          items={IMPORTANT_RULES.mileage}
          variant={variant}
        />
        <RulesBlock
          title="Reserva"
          items={IMPORTANT_RULES.reservation}
          variant={variant}
        />
        <RulesBlock
          title="Política de comida"
          items={IMPORTANT_RULES.foodPolicy}
          variant={variant}
        />
        <RulesBlock
          title="Multa de atraso"
          items={IMPORTANT_RULES.latePayment}
          variant={variant}
        />
        <RulesBlock
          title="Adicional de feriado / data comemorativa"
          items={IMPORTANT_RULES.decemberJanuary}
          variant={variant}
        />
      </div>
    </section>
  )
}

export function CdlCancellationPolicySection({
  variant = 'pdf',
}: {
  variant?: RulesVariant
}) {
  const items = [
    'Cancelamentos e reagendamentos seguem as condições acordadas no momento da reserva.',
    'Em 24, 25 e 31 de dezembro e 1º de janeiro não há reembolso nem reagendamento.',
    'Eventos em feriados federais dos EUA e datas comemorativas (24, 25 e 31 de dezembro e 1º de janeiro) têm acréscimo de 100% e pedido mínimo de $2.000.',
  ] as const

  if (variant === 'summary') {
    return (
      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-7 shadow-cdl sm:p-9">
        <h2 className="cdl-section-title-lg">Política de cancelamento</h2>
        <ul className="mt-4 space-y-2 text-sm text-cdl-text-secondary">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-cdl-title" aria-hidden>
                •
              </span>
              <span>{emphasizeRuleText(item)}</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className="quote-proposal-rules quote-print-section quote-print-keep">
      <h2 className="quote-proposal-section-title">Política de cancelamento</h2>
      <ul className="quote-proposal-rules-list">
        {items.map((item) => (
          <li key={item}>{emphasizeRuleText(item)}</li>
        ))}
      </ul>
    </section>
  )
}

/** Regras + cancelamento (legado / PDF completo). Preferir regras no topo da cotação. */
export function CdlPdfPoliciesSection() {
  return (
    <>
      <CdlImportantRulesPanel variant="pdf" />
      <CdlCancellationPolicySection variant="pdf" />
    </>
  )
}
