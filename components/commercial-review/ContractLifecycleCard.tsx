import Link from 'next/link'
import type { ContractLifecycle } from '@/Lib/payments/paidContractAdvance'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import { ReviewCard } from './ReviewCard'

function Step({
  testId,
  done,
  waiting,
  label,
}: {
  testId: string
  done: boolean
  waiting?: boolean
  label: string
}) {
  const mark = done ? '✅' : waiting ? '⏳' : '○'
  return (
    <li
      data-testid={testId}
      data-done={done ? 'yes' : 'no'}
      data-waiting={waiting ? 'yes' : 'no'}
      className="flex items-start gap-2 text-sm font-semibold text-cdl-title"
    >
      <span aria-hidden="true">{mark}</span>
      <span>{label}</span>
    </li>
  )
}

export function ContractLifecycleCard({
  locale,
  lifecycle,
}: {
  locale: string
  lifecycle: ContractLifecycle
}) {
  const serviceOrderLabel = lifecycle.serviceOrderNumber
    ? tCommercialReview(locale, 'lifecycleServiceOrder', {
        number: lifecycle.serviceOrderNumber,
      })
    : lifecycle.serviceOrderPending
      ? tCommercialReview(locale, 'lifecycleServiceOrderPendingGeneration')
      : tCommercialReview(locale, 'lifecycleAwaitingServiceOrder')

  return (
    <ReviewCard
      title={tCommercialReview(locale, 'lifecycleTitle')}
      testId="commercial-review-lifecycle"
    >
      <ol className="grid gap-2">
        <Step
          testId="lifecycle-proposal"
          done={lifecycle.proposalAccepted}
          label={tCommercialReview(locale, 'lifecycleProposalAccepted')}
        />
        <Step
          testId="lifecycle-deposit"
          done={lifecycle.depositPaid}
          waiting={lifecycle.awaitingDeposit}
          label={
            lifecycle.awaitingDeposit
              ? tCommercialReview(locale, 'lifecycleAwaitingDeposit')
              : tCommercialReview(locale, 'lifecycleDepositPaid')
          }
        />
        <Step
          testId="lifecycle-reservation"
          done={lifecycle.reservationConfirmed}
          label={tCommercialReview(locale, 'lifecycleReservationConfirmed')}
        />
        <Step
          testId="lifecycle-service-order"
          done={lifecycle.serviceOrderPresent}
          waiting={lifecycle.serviceOrderPending}
          label={serviceOrderLabel}
        />
        {lifecycle.paidInFull ? (
          <Step
            testId="lifecycle-paid-in-full"
            done
            label={tCommercialReview(locale, 'lifecyclePaidInFull')}
          />
        ) : null}
      </ol>
      {lifecycle.serviceOrderPending ? (
        <p
          data-testid="lifecycle-service-order-attention"
          className="mt-3 text-sm font-semibold text-amber-800"
        >
          {tCommercialReview(locale, 'lifecycleServiceOrderAttention')}
        </p>
      ) : null}
      {lifecycle.serviceOrderId ? (
        <Link
          href={`/orders/${lifecycle.serviceOrderId}`}
          data-testid="lifecycle-service-order-link"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-black uppercase tracking-wide text-cdl-brand"
        >
          {serviceOrderLabel}
        </Link>
      ) : null}
    </ReviewCard>
  )
}
