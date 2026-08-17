import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'
import type { QuoteAdditionalSaveLine } from '@/Lib/buildQuoteSavePayload'
import type { QuoteTotals } from '@/Lib/calculateQuoteTotals'

export type QuotePricingPreviewRequest = {
  packageId: string
  additionals?: Array<{ itemId: string; quantity: number }>
  adultCount?: number
  childrenUnder3Count?: number
  children4To12Count?: number
  eventDate?: string | null
  mileageDistance?: number
  grillRentalRequired?: boolean
  grillRentalQty?: number
  reservationPercentage?: number | null
  language?: 'pt' | 'en' | 'es' | null
}

export type QuotePricingPreviewResponse = {
  breakdown: PricingBreakdown
  totals: QuoteTotals & {
    packageUnitPrice?: number
    mileageBaseLocation?: string
    mileageFreeLimit?: number
    mileageRate?: number
    reservationPercentage?: number
  }
  packagePricePerPerson: number
  resolvedAdditionals: QuoteAdditionalSaveLine[]
  mileage?: {
    distance: number
    status: 'resolved' | 'pending_review'
  }
}

export type QuotePricingPreviewError = {
  message: string
  code?: string
  field?: string | null
}

export async function fetchQuotePricingPreview(
  body: QuotePricingPreviewRequest,
  signal?: AbortSignal,
  endpoint = '/api/quotes/preview',
): Promise<
  | { ok: true; data: QuotePricingPreviewResponse }
  | { ok: false; error: QuotePricingPreviewError }
> {
  const response = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  let payload: Record<string, unknown> = {}
  try {
    payload = (await response.json()) as Record<string, unknown>
  } catch {
    return {
      ok: false,
      error: { message: 'Resposta inválida do servidor de precificação.' },
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        message:
          typeof payload.error === 'string'
            ? payload.error
            : 'Não foi possível calcular a cotação.',
        code: typeof payload.code === 'string' ? payload.code : undefined,
        field: typeof payload.field === 'string' ? payload.field : null,
      },
    }
  }

  return {
    ok: true,
    data: payload as unknown as QuotePricingPreviewResponse,
  }
}
