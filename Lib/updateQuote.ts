import {
  buildAdditionalItemRows,
  buildEventSavePayload,
  buildPackageSelectionRows,
  buildQuoteSavePayload,
  type QuoteSaveInput,
} from './buildQuoteSavePayload'
import { getCdlCompanyId } from './cdlCompany'
import {
  buildSaveQuoteError,
  logSaveQuoteError,
  type SaveQuoteErrorInfo,
} from './supabaseSaveError'
import { supabase } from './supabase'

export type UpdateQuoteResult = {
  data: { id: string } | null
  error: SaveQuoteErrorInfo | null
}

export async function updateQuote(
  quoteId: string,
  input: QuoteSaveInput,
): Promise<UpdateQuoteResult> {
  const companyId = getCdlCompanyId()

  const { data: existingQuote, error: fetchError } = await supabase
    .from('quotes')
    .select('event_id')
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

  if (eventId) {
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

  const quotePayload = buildQuoteSavePayload(input, {
    mode: 'update',
    eventId: eventId ?? null,
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
      input.additionals,
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
