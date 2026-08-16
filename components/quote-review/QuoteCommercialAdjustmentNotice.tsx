import { formatCurrency } from '@/app/quotes/[id]/quoteDetailTypes'
import { tw } from '@/Lib/quoteTranslations'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

/**
 * Aviso antecipado quando pedido mínimo ou acréscimo de feriado alteram o total.
 * Ex.: base $360 → total $800 (mínimo dia útil).
 */
export default function QuoteCommercialAdjustmentNotice({
  baseSubtotal,
  holidaySurchargeAmount = 0,
  minimumOrderAdjustment = 0,
  minimumOrderAmount = 0,
  quoteTotal,
  language = 'pt',
}: {
  baseSubtotal: number
  holidaySurchargeAmount?: number
  minimumOrderAdjustment?: number
  minimumOrderAmount?: number
  quoteTotal: number | null
  language?: QuoteLanguage | string | null
}) {
  const loc: QuoteLanguage =
    language === 'en' || language === 'es' ? language : 'pt'
  const surcharge = Number(holidaySurchargeAmount) || 0
  const minAdj = Number(minimumOrderAdjustment) || 0
  if (surcharge <= 0 && minAdj <= 0) return null

  return (
    <div
      className="rounded-2xl border border-amber-300/70 bg-amber-50 px-5 py-4 text-sm text-amber-950 shadow-cdl dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50"
      role="status"
    >
      <p className="font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100">
        {tw(loc, 'commercialAdjustment')}
      </p>
      <ul className="mt-2 space-y-1.5 leading-relaxed">
        <li>
          {tw(loc, 'subtotalLine')}:{' '}
          <strong>{formatCurrency(baseSubtotal)}</strong>
        </li>
        {surcharge > 0 ? (
          <li>
            {tQuotesOrders(loc, 'docHolidaySurchargeLine')}:{' '}
            <strong>{formatCurrency(surcharge)}</strong>
          </li>
        ) : null}
        {minAdj > 0 ? (
          <li>
            {tw(loc, 'minOrderRaised', {
              min: formatCurrency(minimumOrderAmount),
              amount: formatCurrency(minAdj),
            })}
          </li>
        ) : null}
        <li>
          {tw(loc, 'quoteTotal')}:{' '}
          <strong>{formatCurrency(quoteTotal ?? 0)}</strong>
        </li>
      </ul>
    </div>
  )
}
