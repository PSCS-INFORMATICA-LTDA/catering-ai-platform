import {
  buildAdditionalItemRows,
  buildEventSavePayload,
  buildPackageSelectionRows,
  buildQuoteSavePayload,
  type QuoteSaveInput,
} from './buildQuoteSavePayload'
import { postalCodeSaveError } from './cep'
import { getCdlCompanyId } from './cdlCompany'
import { syncReservedAgendaEventForQuote } from './quotes/confirmQuoteDepositAndReserveSchedule'
import {
  buildSaveQuoteError,
  logSaveQuoteError,
  type SaveQuoteErrorInfo,
} from './supabaseSaveError'
import { getSupabaseServerClient } from './supabaseServer'
import {
  computeServerPricingForSave,
  mergeServerPricingIntoSaveInput,
} from './pricing/applyServerPricingToQuoteSave'
import type { PricingBreakdown } from './pricing/pricingBreakdownTypes'

export type UpdateQuoteResult = {
  data: { id: string } | null
  error: SaveQuoteErrorInfo | null
}

export async function updateQuote(
  quoteId: string,
  input: QuoteSaveInput,
): Promise<UpdateQuoteResult> {
  const companyId = getCdlCompanyId()
  const zipError = postalCodeSaveError(input.zipCode, true)
  if (zipError) {
    const errorInfo = buildSaveQuoteError('validation', new Error(zipError))
    logSaveQuoteError(errorInfo)
    return { data: null, error: errorInfo }
  }
  const supabase = getSupabaseServerClient()

  const { data: existingQuote, error: fetchError } = await supabase
    .from('quotes')
    .select('event_id, reservation_confirmed_at, pricing_breakdown, quote_total, proposal_accepted_at, accepted_version_id')
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .eq('active', true)
    .maybeSingle()

  if (fetchError) {
    const errorInfo = buildSaveQuoteError('validation', fetchError)
    logSaveQuoteError(errorInfo, fetchError)
    return { data: null, error: errorInfo }
  }

  const eventPayload = buildEventSavePayload(input, { mode: 'update' })
  let eventId = existingQuote?.event_id as string | null | undefined
  let previousEvent: {
    event_name: string | null
    event_date: string | null
    start_time: string | null
    end_time: string | null
  } | null = null

  if (eventId) {
    const { data: beforeEvent } = await supabase
      .from('events')
      .select('event_name, event_date, start_time, end_time')
      .eq('id', eventId)
      .maybeSingle()
    previousEvent = beforeEvent

    const { error: eventUpdateError } = await supabase
      .from('events')
      .update(eventPayload)
      .eq('id', eventId)

    if (eventUpdateError) {
      const errorInfo = buildSaveQuoteError('event', eventUpdateError, {
        eventPayload,
      })
      logSaveQuoteError(errorInfo, eventUpdateError)
      return { data: null, error: errorInfo }
    }
  } else {
    const { data: eventData, error: eventInsertError } = await supabase
      .from('events')
      .insert(eventPayload)
      .select('id')
      .single()

    if (eventInsertError || !eventData?.id) {
      const errorInfo = buildSaveQuoteError('event', eventInsertError, {
        eventPayload,
      })
      logSaveQuoteError(errorInfo, eventInsertError)
      return { data: null, error: errorInfo }
    }

    eventId = eventData.id as string
  }

  const shouldRecalculate =
    input.recalculateSnapshot !== false

  let saveInput = input
  let pricingBreakdown: PricingBreakdown | null =
    (existingQuote?.pricing_breakdown as PricingBreakdown | null) ?? null

  if (shouldRecalculate) {
    const pricingResult = await computeServerPricingForSave(input)
    if (!pricingResult.ok) {
      const errorInfo = buildSaveQuoteError(
        'validation',
        new Error(pricingResult.error.message),
      )
      logSaveQuoteError(errorInfo)
      return { data: null, error: errorInfo }
    }
    saveInput = mergeServerPricingIntoSaveInput(input, pricingResult)
    pricingBreakdown = pricingResult.breakdown
  }

  const quotePayload = buildQuoteSavePayload(saveInput, {
    mode: 'update',
    eventId: eventId ?? null,
    pricingBreakdown,
  })

  const { error: updateError } = await supabase
    .from('quotes')
    .update(quotePayload)
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .eq('active', true)

  if (updateError) {
    const errorInfo = buildSaveQuoteError('quote', updateError, {
      eventPayload,
      quotePayload,
    })
    logSaveQuoteError(errorInfo, updateError)
    return { data: null, error: errorInfo }
  }

  // Sinal já confirmado: mover/atualizar a mesma reserva (sem duplicar).
  if (existingQuote?.reservation_confirmed_at) {
    const sync = await syncReservedAgendaEventForQuote({
      companyId,
      quoteId,
      requireConfirmed: true,
    })
    if (!sync.ok) {
      if (eventId && previousEvent) {
        await supabase.from('events').update(previousEvent).eq('id', eventId)
      }
      const errorInfo = buildSaveQuoteError(
        'event',
        new Error(sync.error ?? 'Conflito ao atualizar reserva na agenda.'),
        { eventPayload },
      )
      logSaveQuoteError(errorInfo)
      return { data: null, error: errorInfo }
    }
  }

  const { error: deleteSelectionsError } = await supabase
    .from('quote_package_selections')
    .delete()
    .eq('quote_id', quoteId)

  if (deleteSelectionsError) {
    const errorInfo = buildSaveQuoteError('quote', deleteSelectionsError, {
      quotePayload,
    })
    errorInfo.message = `Falha ao limpar escolhas do pacote antes de atualizar: ${errorInfo.message}`
    logSaveQuoteError(errorInfo, deleteSelectionsError)
    return { data: null, error: errorInfo }
  }

  const packageSelections = input.packageSelections ?? []
  if (packageSelections.length > 0) {
    let selectionRows: ReturnType<typeof buildPackageSelectionRows>
    try {
      selectionRows = buildPackageSelectionRows(
        quoteId,
        companyId,
        input.packageId,
        packageSelections,
      )
    } catch (error) {
      const errorInfo = buildSaveQuoteError('quote', error, {
        eventPayload,
        quotePayload,
      })
      logSaveQuoteError(errorInfo, error)
      return { data: null, error: errorInfo }
    }

    const { error: selectionsError } = await supabase
      .from('quote_package_selections')
      .insert(selectionRows)

    if (selectionsError) {
      const errorInfo = buildSaveQuoteError('quote', selectionsError, {
        eventPayload,
        quotePayload,
      })
      errorInfo.message = `Cotação atualizada, mas falhou ao salvar escolhas do pacote: ${errorInfo.message}`
      logSaveQuoteError(errorInfo, selectionsError)
      return { data: null, error: errorInfo }
    }
  }

  const { error: deleteError } = await supabase
    .from('quote_additional_items')
    .delete()
    .eq('quote_id', quoteId)

  if (deleteError) {
    const errorInfo = buildSaveQuoteError('additionals', deleteError, {
      quotePayload,
    })
    errorInfo.message = `Falha ao limpar adicionais antes de atualizar: ${errorInfo.message}`
    logSaveQuoteError(errorInfo, deleteError)
    return { data: null, error: errorInfo }
  }

  if (input.additionals.length === 0) {
    return { data: { id: quoteId }, error: null }
  }

  let additionalItemsPayload: ReturnType<typeof buildAdditionalItemRows>
  try {
    additionalItemsPayload = buildAdditionalItemRows(
      quoteId,
      companyId,
      saveInput.additionals,
    )
  } catch (error) {
    const errorInfo = buildSaveQuoteError('additionals', error, {
      eventPayload,
      quotePayload,
    })
    logSaveQuoteError(errorInfo, error)
    return { data: null, error: errorInfo }
  }

  const { error: linesError } = await supabase
    .from('quote_additional_items')
    .insert(additionalItemsPayload)

  if (linesError) {
    const errorInfo = buildSaveQuoteError('additionals', linesError, {
      eventPayload,
      quotePayload,
      additionalItemsPayload,
    })
    errorInfo.message = `Cotação atualizada, mas falhou ao salvar adicionais: ${errorInfo.message}`
    logSaveQuoteError(errorInfo, linesError)
    return { data: null, error: errorInfo }
  }

  return { data: { id: quoteId }, error: null }
}
