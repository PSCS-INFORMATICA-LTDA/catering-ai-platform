import { getSupabaseServerClient } from './supabaseServer'

/** quote=Q-YYYY-000001 · order=O · service_order=SO · customer=AB000001 · invoice=INV */
export type DocumentType =
  | 'quote'
  | 'order'
  | 'service_order'
  | 'customer'
  | 'invoice'

export type GetNextDocumentNumberResult = {
  number: string | null
  error: { message: string; details: string | null } | null
}

export async function getNextDocumentNumber(
  companyId: string,
  documentType: DocumentType,
): Promise<GetNextDocumentNumberResult> {
  const normalizedCompanyId = companyId?.trim()
  if (!normalizedCompanyId) {
    return {
      number: null,
      error: {
        message: 'company_id é obrigatório para gerar número do documento.',
        details: null,
      },
    }
  }

  const { data, error } = await getSupabaseServerClient().rpc(
    'get_next_document_number',
    {
    p_company_id: normalizedCompanyId,
      p_document_type: documentType,
    },
  )

  if (error) {
    return {
      number: null,
      error: {
        message: `Falha na RPC get_next_document_number (${documentType}): ${error.message}`,
        details: error.details ?? error.hint ?? null,
      },
    }
  }

  const number = typeof data === 'string' ? data.trim() : ''
  if (!number) {
    return {
      number: null,
      error: {
        message: `RPC get_next_document_number retornou vazio para tipo "${documentType}".`,
        details: null,
      },
    }
  }

  return { number, error: null }
}

export function getNextQuoteNumber(companyId: string) {
  return getNextDocumentNumber(companyId, 'quote')
}

export function getNextOrderNumber(companyId: string) {
  return getNextDocumentNumber(companyId, 'order')
}

export function getNextServiceOrderNumber(companyId: string) {
  return getNextDocumentNumber(companyId, 'service_order')
}

/** Address book — formato AB000001 */
export function getNextCustomerNumber(companyId: string) {
  return getNextDocumentNumber(companyId, 'customer')
}

export const getNextAbNumber = getNextCustomerNumber

export function getNextInvoiceNumber(companyId: string) {
  return getNextDocumentNumber(companyId, 'invoice')
}
