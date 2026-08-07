import { formatCurrency } from '@/app/quotes/[id]/quoteDetailTypes'

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
}: {
  baseSubtotal: number
  holidaySurchargeAmount?: number
  minimumOrderAdjustment?: number
  minimumOrderAmount?: number
  quoteTotal: number | null
}) {
  const surcharge = Number(holidaySurchargeAmount) || 0
  const minAdj = Number(minimumOrderAdjustment) || 0
  if (surcharge <= 0 && minAdj <= 0) return null

  return (
    <div
      className="rounded-2xl border border-amber-300/70 bg-amber-50 px-5 py-4 text-sm text-amber-950 shadow-cdl dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50"
      role="status"
    >
      <p className="font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100">
        Ajuste comercial aplicado
      </p>
      <ul className="mt-2 space-y-1.5 leading-relaxed">
        <li>
          Subtotal (pacote + adicionais + milhagem):{' '}
          <strong>{formatCurrency(baseSubtotal)}</strong>
        </li>
        {surcharge > 0 ? (
          <li>
            Adicional de feriado / data comemorativa (100%):{' '}
            <strong>{formatCurrency(surcharge)}</strong>
          </li>
        ) : null}
        {minAdj > 0 ? (
          <li>
            Pedido mínimo aplicado (mín.{' '}
            {formatCurrency(minimumOrderAmount)}): o total foi elevado em{' '}
            <strong>{formatCurrency(minAdj)}</strong> para cumprir a regra da
            data do evento.
          </li>
        ) : null}
        <li>
          Total da cotação:{' '}
          <strong>{formatCurrency(quoteTotal ?? 0)}</strong>
        </li>
      </ul>
    </div>
  )
}
