import type { SupabaseClient } from '@supabase/supabase-js'
import type { CouponQuotePatch } from './couponSnapshot.ts'

type QuotePatch = CouponQuotePatch

async function revertApplicationToPending(
  db: SupabaseClient,
  companyId: string,
  applicationId: string,
) {
  await db
    .from('quote_coupon_applications')
    .update({
      approval_status: 'pending',
      applied_discount_amount: 0,
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .eq('company_id', companyId)
}

export async function decideQuoteCouponFallback(input: {
  db: SupabaseClient
  companyId: string
  applicationId: string
  quoteId: string
  userId: string
  action: 'approve' | 'reject'
  quotePatch: QuotePatch | null
}): Promise<
  | { ok: true; status: 'applied' | 'rejected'; idempotent?: boolean }
  | { ok: false; error: string; status: number }
> {
  const now = new Date().toISOString()
  const { db } = input

  if (input.action === 'reject') {
    const claimed = await db
      .from('quote_coupon_applications')
      .update({
        approval_status: 'rejected',
        applied_discount_amount: 0,
        rejected_by: input.userId,
        rejected_at: now,
        updated_at: now,
      })
      .eq('id', input.applicationId)
      .eq('company_id', input.companyId)
      .eq('approval_status', 'pending')
      .select('id')
      .maybeSingle()
    if (claimed.error) {
      return { ok: false, error: 'Não foi possível rejeitar o cupom.', status: 500 }
    }
    if (!claimed.data) {
      return { ok: true, status: 'rejected', idempotent: true }
    }
    if (!input.quotePatch) {
      return { ok: true, status: 'rejected' }
    }
  } else {
    if (!input.quotePatch) {
      return { ok: false, error: 'Solicitação inválida.', status: 400 }
    }
  }

  if (!input.quotePatch) {
    return { ok: false, error: 'Solicitação inválida.', status: 400 }
  }

  const { data: originalQuote, error: originalQuoteError } = await db
    .from('quotes')
    .select(
      'id, discount, discount_amount, reservation_amount, deposit_amount, balance_due, total_amount, quote_total, pricing_breakdown',
    )
    .eq('id', input.quoteId)
    .eq('company_id', input.companyId)
    .maybeSingle()
  if (originalQuoteError || !originalQuote) {
    await revertApplicationToPending(db, input.companyId, input.applicationId)
    return { ok: false, error: 'Falha ao carregar a cotação.', status: 500 }
  }

  const { data: originalVersions, error: originalVersionsError } = await db
    .from('quote_versions')
    .select('id, discount_amount, reservation_amount, balance_due, quote_total, commercial_snapshot')
    .eq('quote_id', input.quoteId)
    .eq('company_id', input.companyId)
    .eq('is_current', true)
  if (originalVersionsError) {
    await revertApplicationToPending(db, input.companyId, input.applicationId)
    return { ok: false, error: 'Não foi possível atualizar a versão da cotação.', status: 500 }
  }

  if (input.action === 'approve') {
    const claimed = await db
      .from('quote_coupon_applications')
      .update({
        approval_status: 'applied',
        applied_discount_amount: input.quotePatch.discount_amount,
        approved_by: input.userId,
        approved_at: now,
        updated_at: now,
      })
      .eq('id', input.applicationId)
      .eq('company_id', input.companyId)
      .eq('approval_status', 'pending')
      .select('id')
      .maybeSingle()
    if (claimed.error) {
      return { ok: false, error: 'Não foi possível aprovar o cupom.', status: 500 }
    }
    if (!claimed.data) {
      return { ok: true, status: 'applied', idempotent: true }
    }
  }

  const quoteUpdate = await db
    .from('quotes')
    .update({
      discount: input.quotePatch.discount,
      discount_amount: input.quotePatch.discount_amount,
      reservation_amount: input.quotePatch.reservation_amount,
      deposit_amount: input.quotePatch.deposit_amount,
      balance_due: input.quotePatch.balance_due,
      total_amount: input.quotePatch.total_amount,
      quote_total: input.quotePatch.quote_total,
      pricing_breakdown: input.quotePatch.pricing_breakdown,
    })
    .eq('id', input.quoteId)
    .eq('company_id', input.companyId)
  if (quoteUpdate.error) {
    await revertApplicationToPending(db, input.companyId, input.applicationId)
    return {
      ok: false,
      error:
        input.action === 'reject'
          ? 'Não foi possível atualizar a cotação rejeitada.'
          : 'Não foi possível atualizar a cotação aprovada.',
      status: 500,
    }
  }

  for (const version of originalVersions ?? []) {
    const snapshot =
      version.commercial_snapshot && typeof version.commercial_snapshot === 'object'
        ? { ...(version.commercial_snapshot as Record<string, unknown>) }
        : {}
    const { error } = await db
      .from('quote_versions')
      .update({
        discount_amount: input.quotePatch.discount_amount,
        reservation_amount: input.quotePatch.reservation_amount,
        balance_due: input.quotePatch.balance_due,
        quote_total: input.quotePatch.quote_total,
        commercial_snapshot: {
          ...snapshot,
          pricing_breakdown: input.quotePatch.pricing_breakdown,
          coupon: input.quotePatch.coupon_snapshot,
        },
      })
      .eq('id', version.id)
      .eq('company_id', input.companyId)
    if (error) {
      await db
        .from('quotes')
        .update({
          discount: originalQuote.discount,
          discount_amount: originalQuote.discount_amount,
          reservation_amount: originalQuote.reservation_amount,
          deposit_amount: originalQuote.deposit_amount,
          balance_due: originalQuote.balance_due,
          total_amount: originalQuote.total_amount,
          quote_total: originalQuote.quote_total,
          pricing_breakdown: originalQuote.pricing_breakdown,
        })
        .eq('id', input.quoteId)
        .eq('company_id', input.companyId)
      for (const previous of originalVersions ?? []) {
        await db
          .from('quote_versions')
          .update({
            discount_amount: previous.discount_amount,
            reservation_amount: previous.reservation_amount,
            balance_due: previous.balance_due,
            quote_total: previous.quote_total,
            commercial_snapshot: previous.commercial_snapshot,
          })
          .eq('id', previous.id)
          .eq('company_id', input.companyId)
      }
      await revertApplicationToPending(db, input.companyId, input.applicationId)
      return { ok: false, error: 'Não foi possível gravar o snapshot da versão.', status: 500 }
    }
  }

  return { ok: true, status: input.action === 'reject' ? 'rejected' : 'applied' }
}
