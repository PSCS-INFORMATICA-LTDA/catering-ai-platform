import {
  CANCELLATION_POLICY_SUMMARY,
  IMPORTANT_RULES,
} from '@/Lib/cdlCommercialRules'

/** Regras comerciais na Confirmação — sem milhagem (seção própria) nem datas já na cancelamento. */
export function flattenConfirmationCommercialRules(): string[] {
  return [
    ...IMPORTANT_RULES.minimumOrder,
    ...IMPORTANT_RULES.reservation,
    ...IMPORTANT_RULES.foodPolicy,
    ...IMPORTANT_RULES.latePayment,
  ]
}

export function confirmationCancellationPolicy(): readonly string[] {
  return CANCELLATION_POLICY_SUMMARY
}
