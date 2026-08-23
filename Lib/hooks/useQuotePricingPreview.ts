'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchQuotePricingPreview,
  type QuotePricingPreviewRequest,
  type QuotePricingPreviewResponse,
  type QuotePricingPreviewError,
} from '@/Lib/fetchQuotePricingPreview'

const DEBOUNCE_MS = 450
const PREVIEW_TIMEOUT_MS = 15000

export type UseQuotePricingPreviewInput = Omit<
  QuotePricingPreviewRequest,
  'packageId'
> & {
  packageId: string | null
  enabled?: boolean
  endpoint?: string
}

export type UseQuotePricingPreviewResult = {
  data: QuotePricingPreviewResponse | null
  loading: boolean
  error: QuotePricingPreviewError | null
  refresh: () => void
}

export function useQuotePricingPreview(
  input: UseQuotePricingPreviewInput,
): UseQuotePricingPreviewResult {
  const [data, setData] = useState<QuotePricingPreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<QuotePricingPreviewError | null>(null)
  const requestSeq = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const serialized = useMemo(
    () =>
      JSON.stringify({
        packageId: input.packageId,
        additionals: input.additionals ?? [],
        adultCount: input.adultCount ?? 0,
        childrenUnder3Count: input.childrenUnder3Count ?? 0,
        children4To12Count: input.children4To12Count ?? 0,
        eventDate: input.eventDate ?? '',
        mileageDistance: input.mileageDistance ?? 0,
        grillRentalRequired: Boolean(input.grillRentalRequired),
        grillRentalQty: input.grillRentalQty ?? 0,
        reservationPercentage: input.reservationPercentage ?? null,
        language: input.language ?? 'pt',
        event: input.event ?? null,
        endpoint: input.endpoint ?? '/api/quotes/preview',
        refreshToken,
      }),
    [
      input.packageId,
      input.additionals,
      input.adultCount,
      input.childrenUnder3Count,
      input.children4To12Count,
      input.eventDate,
      input.mileageDistance,
      input.grillRentalRequired,
      input.grillRentalQty,
      input.reservationPercentage,
      input.language,
      input.event,
      input.endpoint,
      refreshToken,
    ],
  )

  useEffect(() => {
    if (input.enabled === false || !input.packageId?.trim()) {
      const resetTimer = window.setTimeout(() => {
        setLoading(false)
        setError(null)
        setData(null)
      }, 0)
      return () => window.clearTimeout(resetTimer)
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const seq = ++requestSeq.current
      setLoading(true)
      setError(null)
      let timedOut = false
      const timeout = window.setTimeout(() => {
        timedOut = true
        controller.abort()
      }, PREVIEW_TIMEOUT_MS)

      try {
        const result = await fetchQuotePricingPreview(
          {
            packageId: input.packageId!.trim(),
            additionals: input.additionals,
            adultCount: input.adultCount,
            childrenUnder3Count: input.childrenUnder3Count,
            children4To12Count: input.children4To12Count,
            eventDate: input.eventDate,
            mileageDistance: input.mileageDistance,
            grillRentalRequired: input.grillRentalRequired,
            grillRentalQty: input.grillRentalQty,
            reservationPercentage: input.reservationPercentage,
            language: input.language,
            event: input.event,
          },
          controller.signal,
          input.endpoint,
        )

        if (seq !== requestSeq.current) return

        if (result.ok) {
          setData(result.data)
          setError(null)
        } else if (controller.signal.aborted && !timedOut) {
          return
        } else if (timedOut) {
          setData(null)
          setError({ message: 'timeout', code: 'timeout' })
        } else {
          setData(null)
          setError(result.error)
        }
      } catch {
        if (seq !== requestSeq.current) return
        if (controller.signal.aborted && !timedOut) return
        setData(null)
        setError({
          message: timedOut ? 'timeout' : 'network',
          code: timedOut ? 'timeout' : 'network',
        })
      } finally {
        window.clearTimeout(timeout)
        if (seq === requestSeq.current) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [serialized, input.enabled, input.packageId])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return {
    data,
    loading,
    error,
    refresh: () => setRefreshToken((n) => n + 1),
  }
}
