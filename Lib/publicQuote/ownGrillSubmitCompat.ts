import type { SupabaseClient } from '@supabase/supabase-js'
import type { PublicQuoteDraft } from './types'

const OWN_GRILL_WITHOUT_PHOTO_PATCH = {
  has_grill: true,
  grill_photo_required: false,
  grill_rental_required: false,
  grill_rental_qty: 0,
} as const

export function isOwnGrillWithoutPhoto(draft: PublicQuoteDraft): boolean {
  return draft.grill.hasGrill === true && !draft.grill.photoReference
}

/**
 * The live finalize_public_quote RPC still rejects hasGrill=true without a
 * storage photo. The function already accepts hasGrill=false with no rental.
 * Send that shape, then persist the real own-grill / no-photo flags.
 */
export function toFinalizePayloadForCurrentRpc(
  draft: PublicQuoteDraft,
): PublicQuoteDraft {
  if (!isOwnGrillWithoutPhoto(draft)) return draft
  return {
    ...draft,
    grill: {
      ...draft.grill,
      hasGrill: false,
      rentalRequired: false,
      rentalQty: 0,
    },
  }
}

export async function persistOwnGrillWithoutPhoto(
  supabase: SupabaseClient,
  companyId: string,
  quoteId: string,
): Promise<boolean> {
  const quote = await supabase
    .from('quotes')
    .select('id, event_id')
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!quote.data?.event_id) return false

  const eventUp = await supabase
    .from('events')
    .update(OWN_GRILL_WITHOUT_PHOTO_PATCH)
    .eq('id', quote.data.event_id)
    .eq('company_id', companyId)
  const quoteUp = await supabase
    .from('quotes')
    .update(OWN_GRILL_WITHOUT_PHOTO_PATCH)
    .eq('id', quoteId)
    .eq('company_id', companyId)
  if (eventUp.error || quoteUp.error) return false

  const versions = await supabase
    .from('quote_versions')
    .select('id, commercial_snapshot')
    .eq('quote_id', quoteId)
  if (versions.error) return false
  for (const row of versions.data ?? []) {
    const snapshot =
      row.commercial_snapshot && typeof row.commercial_snapshot === 'object'
        ? { ...(row.commercial_snapshot as Record<string, unknown>) }
        : {}
    const grill =
      snapshot.grill && typeof snapshot.grill === 'object'
        ? { ...(snapshot.grill as Record<string, unknown>) }
        : {}
    grill.hasGrill = true
    grill.rentalRequired = false
    grill.rentalQty = 0
    if (!grill.photoReference) grill.photoReference = null
    const updated = await supabase
      .from('quote_versions')
      .update({ commercial_snapshot: { ...snapshot, grill } })
      .eq('id', row.id)
    if (updated.error) return false
  }
  return true
}

export async function rollbackPublicQuoteFinalize(
  supabase: SupabaseClient,
  companyId: string,
  quoteId: string,
  sessionId: string,
): Promise<void> {
  const quote = await supabase
    .from('quotes')
    .select('event_id')
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .maybeSingle()
  const eventId = quote.data?.event_id ?? null

  await supabase.from('quote_package_selections').delete().eq('quote_id', quoteId)
  await supabase.from('quote_additional_items').delete().eq('quote_id', quoteId)
  await supabase.from('quote_versions').delete().eq('quote_id', quoteId)
  await supabase.from('quotes').delete().eq('id', quoteId).eq('company_id', companyId)
  if (eventId) {
    await supabase
      .from('media_assets')
      .delete()
      .eq('entity_type', 'event')
      .eq('entity_id', eventId)
    await supabase.from('events').delete().eq('id', eventId).eq('company_id', companyId)
  }
  await supabase
    .from('public_quote_intake_sessions')
    .update({
      status: 'active',
      quote_id: null,
      idempotency_key_hash: null,
      submission_hash: null,
    })
    .eq('id', sessionId)
    .eq('company_id', companyId)
}
