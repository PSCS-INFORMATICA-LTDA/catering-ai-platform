import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('activities', 'operations', {
  title: {
    pt: 'Atividades e transações',
    en: 'Activities and transactions',
    es: 'Actividades y transacciones',
  },
  subtitle: {
    pt: 'O que aconteceu, com quem, quanto entrou e se o WhatsApp foi entregue.',
    en: 'What happened, with whom, how much arrived, and whether WhatsApp was delivered.',
    es: 'Qué ocurrió, con quién, cuánto entró y si WhatsApp se entregó.',
  },
  tabSummary: { pt: 'Resumo', en: 'Summary', es: 'Resumen' },
  tabTransactions: { pt: 'Transações', en: 'Transactions', es: 'Transacciones' },
  tabWhatsapp: { pt: 'Atividades / WhatsApp', en: 'Activities / WhatsApp', es: 'Actividades / WhatsApp' },
  quotesCreated: { pt: 'Novas cotações', en: 'New quotes', es: 'Nuevos presupuestos' },
  quotesAccepted: { pt: 'Aceites', en: 'Accepted quotes', es: 'Aceptaciones' },
  deposits: { pt: 'Sinais recebidos', en: 'Deposits received', es: 'Señales recibidas' },
  settled: { pt: 'Faturas quitadas', en: 'Invoices settled', es: 'Facturas saldadas' },
  needsAttention: { pt: 'Precisa de atenção', en: 'Needs attention', es: 'Requiere atención' },
  filterPeriod: { pt: 'Período', en: 'Period', es: 'Período' },
  filterFrom: { pt: 'De', en: 'From', es: 'Desde' },
  filterTo: { pt: 'Até', en: 'To', es: 'Hasta' },
  filterQuery: { pt: 'Cliente ou evento', en: 'Customer or event', es: 'Cliente o evento' },
  filterType: { pt: 'Tipo', en: 'Type', es: 'Tipo' },
  filterStatus: { pt: 'Status', en: 'Status', es: 'Estado' },
  financialStatus: { pt: 'Status financeiro', en: 'Financial status', es: 'Estado financiero' },
  whatsappStatus: { pt: 'Status do WhatsApp', en: 'WhatsApp status', es: 'Estado de WhatsApp' },
  receivedNow: { pt: 'Recebido agora', en: 'Received now', es: 'Recibido ahora' },
  paidTotal: { pt: 'Total pago', en: 'Total paid', es: 'Total pagado' },
  outstanding: { pt: 'Saldo atual', en: 'Current balance', es: 'Saldo actual' },
  open: { pt: 'Abrir', en: 'Open', es: 'Abrir' },
  emptyTransactions: {
    pt: 'Nenhuma transação confirmada neste filtro.',
    en: 'No confirmed transactions in this filter.',
    es: 'No hay transacciones confirmadas en este filtro.',
  },
  emptyActivities: {
    pt: 'Nenhuma atividade registrada neste filtro.',
    en: 'No activities recorded in this filter.',
    es: 'No hay actividades registradas en este filtro.',
  },
  multiCurrencyNote: {
    pt: 'Moedas diferentes não são somadas.',
    en: 'Different currencies are not added together.',
    es: 'No se suman monedas distintas.',
  },
  paymentConfirmed: {
    pt: 'Pagamento confirmado',
    en: 'Payment confirmed',
    es: 'Pago confirmado',
  },
  whatsappFailed: {
    pt: 'WhatsApp falhou — o pagamento continua confirmado.',
    en: 'WhatsApp failed — the payment remains confirmed.',
    es: 'WhatsApp falló — el pago sigue confirmado.',
  },
  timeline: { pt: 'Linha do tempo', en: 'Timeline', es: 'Línea de tiempo' },
  timelineQuoteCreated: { pt: 'Cotação criada', en: 'Quote created', es: 'Presupuesto creado' },
  timelineQuoteAccepted: { pt: 'Versão aceita', en: 'Accepted version', es: 'Versión aceptada' },
  timelineDeposit: { pt: 'Sinal recebido', en: 'Deposit received', es: 'Señal recibida' },
  timelineReservation: { pt: 'Reserva confirmada', en: 'Reservation confirmed', es: 'Reserva confirmada' },
  timelinePayment: { pt: 'Pagamento recebido', en: 'Payment received', es: 'Pago recibido' },
  timelineSettled: { pt: 'Fatura quitada', en: 'Invoice settled', es: 'Factura saldada' },
  attempts: { pt: 'Tentativas', en: 'Attempts', es: 'Intentos' },
  recipient: { pt: 'Destinatário', en: 'Recipient', es: 'Destinatario' },
  companyContextRequired: {
    pt: 'Selecione uma empresa para ver atividades e transações.',
    en: 'Select a company to view activities and transactions.',
    es: 'Seleccione una empresa para ver actividades y transacciones.',
  },
  noFinancePermission: {
    pt: 'Sem permissão para ver valores financeiros.',
    en: 'No permission to view financial amounts.',
    es: 'Sin permiso para ver importes financieros.',
  },
})

export const tActivities = t
export const listActivitiesI18nEntries = list
