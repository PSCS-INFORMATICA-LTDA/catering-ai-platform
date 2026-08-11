import {
  buildAdditionalItemRows,
  buildEventSavePayload,
  buildPackageSelectionRows,
  buildQuoteSavePayload,
  type QuoteSaveInput,
} from './buildQuoteSavePayload'
import { getCdlCompanyId } from './cdlCompany'
import { findOrCreateCustomerByPhone } from './findOrCreateCustomerByPhone'
import { getNextQuoteNumber } from './getNextDocumentNumber'
import { isUsablePhone } from './normalizePhone'
import {
  buildSaveQuoteError,
  logSaveQuoteError,
  type SaveQuoteErrorInfo,
} from './supabaseSaveError'
import { getSupabaseServerClient } from './supabaseServer'

export type CreateQuoteResult = {
  data: { id: string; quote_number: string | null } | null
  error: SaveQuoteErrorInfo | null
}

function validateSaveInput(input: QuoteSaveInput): SaveQuoteErrorInfo | null {
  const companyId = getCdlCompanyId()
  if (!input.packageId?.trim()) {
    return buildSaveQuoteError('validation', new Error('package_id vazio.'))
  }
  if (!companyId?.trim()) {
    return buildSaveQuoteError('validation', new Error('company_id vazio.'))
  }
  return null
}

async function findOrCreateCustomerForQuoteSave(
  draft: NonNullable<QuoteSaveInput['customerDraft']>,
): Promise<{
  customer: { id: string } | null
  error: { message: string } | null
}> {
  const payload = {
    phone: draft.phone,
    name: draft.name,
    email: draft.email,
  }

  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/api/customers/find-or-create', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as {
        customer?: { id: string }
        error?: string
      }

      if (!response.ok || !result.customer?.id) {
        return {
          customer: null,
          error: {
            message:
              result.error ?? 'Não foi possível criar ou vincular cliente.',
          },
        }
      }

      return { customer: result.customer, error: null }
    } catch {
      return {
        customer: null,
        error: { message: 'Erro de rede ao criar ou vincular cliente.' },
      }
    }
  }

  const { customer, error } = await findOrCreateCustomerByPhone(payload)
  if (error || !customer?.id) {
    return {
      customer: null,
      error: {
        message: error?.message ?? 'Não foi possível criar ou vincular cliente.',
      },
    }
  }

  return { customer, error: null }
}

async function resolveCustomerIdForSave(
  input: QuoteSaveInput,
): Promise<{ customerId: string | null; error: SaveQuoteErrorInfo | null }> {
  if (input.customerId?.trim()) {
    return { customerId: input.customerId.trim(), error: null }
  }

  const draft = input.customerDraft
  if (!draft?.phone?.trim()) {
    return { customerId: null, error: null }
  }

  if (!isUsablePhone(draft.phone)) {
    return {
      customerId: null,
      error: buildSaveQuoteError(
        'validation',
        new Error('Telefone do cliente inválido (mínimo 10 dígitos).'),
      ),
    }
  }

  const { customer, error } = await findOrCreateCustomerForQuoteSave(draft)

  if (error || !customer?.id) {
    return {
      customerId: null,
      error: buildSaveQuoteError(
        'validation',
        new Error(error?.message ?? 'Não foi possível criar ou vincular cliente.'),
      ),
    }
  }

  return { customerId: customer.id, error: null }
}

export async function createQuote(input: QuoteSaveInput): Promise<CreateQuoteResult> {
  const supabase = getSupabaseServerClient()
  const validationError = validateSaveInput(input)
  if (validationError) {
    logSaveQuoteError(validationError)
    return { data: null, error: validationError }
  }

  const { customerId, error: customerError } =
    await resolveCustomerIdForSave(input)
  if (customerError) {
    logSaveQuoteError(customerError)
    return { data: null, error: customerError }
  }

  const saveInput: QuoteSaveInput = {
    ...input,
    customerId,
    customerDraft: null,
  }

  const companyId = getCdlCompanyId()
  const { number: quoteNumber, error: numberError } =
    await getNextQuoteNumber(companyId)

  if (numberError || !quoteNumber) {
    const errorInfo = buildSaveQuoteError(
      'quote',
      new Error(
        numberError?.message ??
          'Não foi possível gerar quote_number via get_next_document_number.',
      ),
    )
    if (numberError?.details) {
      errorInfo.details = numberError.details
    }
    logSaveQuoteError(errorInfo)
    return { data: null, error: errorInfo }
  }

  const eventPayload = buildEventSavePayload(saveInput, { mode: 'create' })
  if (!eventPayload.company_id) {
    const errorInfo = buildSaveQuoteError(
      'event',
      new Error(
        'Insert em events sem company_id. RLS events_insert_member recusa NULL.',
      ),
      { eventPayload },
    )
    logSaveQuoteError(errorInfo)
    return { data: null, error: errorInfo }
  }

  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .insert(eventPayload)
    .select('id')
    .single()

  if (eventError || !eventData?.id) {
    const errorInfo = buildSaveQuoteError(
      'event',
      eventError ??
        new Error(
          'Insert em events não retornou id. Possível RLS, coluna inválida ou FK ausente.',
        ),
      { eventPayload },
    )
    logSaveQuoteError(errorInfo, eventError)
    return { data: null, error: errorInfo }
  }

  const eventId = eventData.id as string
  const quotePayload = {
    ...buildQuoteSavePayload(saveInput, {
      mode: 'create',
      eventId,
    }),
    quote_number: quoteNumber,
  }

  const { data, error } = await supabase
    .from('quotes')
    .insert(quotePayload)
    .select('id, quote_number')
    .single()

  if (error || !data?.id) {
    const errorInfo = buildSaveQuoteError(
      'quote',
      error ??
        new Error(
          'Insert em quotes não retornou id. Possível RLS, coluna inválida ou event_id ausente.',
        ),
      {
        eventPayload,
        quotePayload,
      },
    )
    logSaveQuoteError(errorInfo, error)
    await supabase.from('events').delete().eq('id', eventId)
    return { data: null, error: errorInfo }
  }

  const quoteId = data.id as string
  const packageSelections = saveInput.packageSelections ?? []

  if (packageSelections.length > 0) {
    let selectionRows: ReturnType<typeof buildPackageSelectionRows>
    try {
      selectionRows = buildPackageSelectionRows(
        quoteId,
        companyId,
        saveInput.packageId,
        packageSelections,
      )
    } catch (error) {
      const errorInfo = buildSaveQuoteError('quote', error, {
        eventPayload,
        quotePayload,
      })
      logSaveQuoteError(errorInfo, error)
      await supabase.from('quotes').delete().eq('id', quoteId)
      await supabase.from('events').delete().eq('id', eventId)
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
      errorInfo.message = `Cotação ${quoteId} criada, mas falhou ao salvar escolhas do pacote: ${errorInfo.message}`
      logSaveQuoteError(errorInfo, selectionsError)
      await supabase
        .from('quote_package_selections')
        .delete()
        .eq('quote_id', quoteId)
      await supabase.from('quotes').delete().eq('id', quoteId)
      await supabase.from('events').delete().eq('id', eventId)
      return { data: null, error: errorInfo }
    }
  }

  if (saveInput.additionals.length === 0) {
    return {
      data: { id: quoteId, quote_number: data.quote_number as string | null },
      error: null,
    }
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
    await supabase.from('quotes').delete().eq('id', quoteId)
    await supabase.from('events').delete().eq('id', eventId)
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
    errorInfo.message = `Cotação ${quoteId} criada, mas falhou ao salvar adicionais: ${errorInfo.message}`
    logSaveQuoteError(errorInfo, linesError)
    await supabase.from('quote_additional_items').delete().eq('quote_id', quoteId)
    await supabase.from('quotes').delete().eq('id', quoteId)
    await supabase.from('events').delete().eq('id', eventId)
    return { data: null, error: errorInfo }
  }

  return {
    data: { id: quoteId, quote_number: data.quote_number as string | null },
    error: null,
  }
}
