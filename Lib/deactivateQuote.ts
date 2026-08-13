import { cancelAgendaReservationForQuote } from '@/Lib/quotes/confirmQuoteDepositAndReserveSchedule'
import { getActiveCompanyId } from '@/Lib/tenant/resolveTenant'
import { getSupabaseServerClient } from './supabaseServer'

export async function deactivateQuote(quoteId: string) {
  const companyId = getActiveCompanyId()
  const supabase = getSupabaseServerClient()

  const { data, error } = await supabase
    .from('quotes')
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .eq('active', true)
    .select('id')
    .maybeSingle()

  if (error) {
    return { data: null, error }
  }

  if (!data?.id) {
    return {
      data: null,
      error: new Error('Cotação não encontrada ou já excluída.'),
    }
  }

  // Libera reserva de agenda criada no sinal (sem apagar histórico).
  await cancelAgendaReservationForQuote({
    companyId,
    quoteId,
    reason: 'Cotação desativada',
  })

  return { data: { id: data.id as string }, error: null }
}
