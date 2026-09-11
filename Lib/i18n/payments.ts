import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('payments', 'billing', {
  invoiceTitle: { pt: 'Fatura', en: 'Invoice', es: 'Factura' },
  generateInvoice: {
    pt: 'Gerar fatura',
    en: 'Generate invoice',
    es: 'Generar factura',
  },
  invoiceReady: {
    pt: 'Fatura pronta',
    en: 'Invoice ready',
    es: 'Factura lista',
  },
  invoiceNumber: {
    pt: 'Fatura {number}',
    en: 'Invoice {number}',
    es: 'Factura {number}',
  },
  paymentStatus: { pt: 'Status do pagamento', en: 'Payment status', es: 'Estado del pago' },
  amountDue: { pt: 'Valor em aberto', en: 'Amount due', es: 'Monto pendiente' },
  invoiceOutstanding: {
    pt: 'Saldo da fatura',
    en: 'Invoice outstanding',
    es: 'Saldo de la factura',
  },
  payDeposit: { pt: 'Pagar sinal (30%)', en: 'Pay deposit (30%)', es: 'Pagar seña (30%)' },
  payBalance: { pt: 'Pagar saldo (70%)', en: 'Pay balance (70%)', es: 'Pagar saldo (70%)' },
  createPaymentLink: {
    pt: 'Criar link seguro',
    en: 'Create secure link',
    es: 'Crear enlace seguro',
  },
  copyLink: { pt: 'Copiar link', en: 'Copy link', es: 'Copiar enlace' },
  downloadPdf: { pt: 'Baixar PDF', en: 'Download PDF', es: 'Descargar PDF' },
  statusDraft: { pt: 'Rascunho', en: 'Draft', es: 'Borrador' },
  statusReady: { pt: 'Pronta', en: 'Ready', es: 'Lista' },
  statusAwaitingDeposit: {
    pt: 'Aguardando sinal',
    en: 'Awaiting deposit',
    es: 'Esperando seña',
  },
  statusPartiallyPaid: {
    pt: 'Parcialmente pago',
    en: 'Partially paid',
    es: 'Parcialmente pagado',
  },
  statusPaid: { pt: 'Pago', en: 'Paid', es: 'Pagado' },
  statusCanceled: { pt: 'Cancelada', en: 'Canceled', es: 'Cancelada' },
  paymentCreated: { pt: 'Criado', en: 'Created', es: 'Creado' },
  paymentApproved: { pt: 'Aprovado', en: 'Approved', es: 'Aprobado' },
  paymentCompleted: { pt: 'Concluído', en: 'Completed', es: 'Completado' },
  paymentFailed: { pt: 'Falhou', en: 'Failed', es: 'Fallido' },
  paymentCanceled: { pt: 'Cancelado', en: 'Canceled', es: 'Cancelado' },
  purposeDeposit: { pt: 'Sinal', en: 'Deposit', es: 'Seña' },
  purposeBalance: { pt: 'Saldo', en: 'Balance', es: 'Saldo' },
  purposeFull: { pt: 'Pagamento integral', en: 'Full payment', es: 'Pago total' },
  providerPaypal: { pt: 'PayPal', en: 'PayPal', es: 'PayPal' },
  providerZelle: { pt: 'Zelle', en: 'Zelle', es: 'Zelle' },
  providerBankTransfer: {
    pt: 'Transferência bancária',
    en: 'Bank transfer',
    es: 'Transferencia bancaria',
  },
  publicPayTitle: {
    pt: 'Pagamento da fatura',
    en: 'Invoice payment',
    es: 'Pago de la factura',
  },
  invoiceSummary: { pt: 'Resumo da fatura', en: 'Invoice summary', es: 'Resumen de la factura' },
  total: { pt: 'Total', en: 'Total', es: 'Total' },
  deposit: { pt: 'Sinal', en: 'Deposit', es: 'Seña' },
  balance: { pt: 'Saldo', en: 'Balance', es: 'Saldo' },
  originalBalance: {
    pt: 'Saldo original após sinal',
    en: 'Original balance after deposit',
    es: 'Saldo original después de la seña',
  },
  paid: { pt: 'Pago até agora', en: 'Paid so far', es: 'Pagado hasta ahora' },
  methods: { pt: 'Formas de pagamento', en: 'Payment methods', es: 'Métodos de pago' },
  zelle: {
    pt: 'Zelle — peça as instruções à CDL pelo WhatsApp ou e-mail.',
    en: 'Zelle — ask CDL for instructions on WhatsApp or email.',
    es: 'Zelle — pida las instrucciones a CDL por WhatsApp o correo.',
  },
  bankTransfer: {
    pt: 'Transferência bancária — peça os dados à CDL.',
    en: 'Bank transfer — ask CDL for the account details.',
    es: 'Transferencia bancaria — pida los datos a CDL.',
  },
  paypalUnavailable: {
    pt: 'PayPal online estará disponível após homologação. Nenhum pagamento online está ativo para o cliente final.',
    en: 'Online PayPal will be available after approval. No live customer checkout is enabled.',
    es: 'PayPal online estará disponible después de la homologación. El checkout público no está activo.',
  },
  paypalSandboxReady: {
    pt: 'PayPal Sandbox (homologação interna)',
    en: 'PayPal Sandbox (internal homologation)',
    es: 'PayPal Sandbox (homologación interna)',
  },
  linkInvalid: {
    pt: 'Este link de pagamento não é válido.',
    en: 'This payment link is not valid.',
    es: 'Este enlace de pago no es válido.',
  },
  alreadyPaid: {
    pt: 'Esta fatura já foi paga.',
    en: 'This invoice is already paid.',
    es: 'Esta factura ya está pagada.',
  },
  noTax: {
    pt: 'Sem imposto sobre vendas.',
    en: 'No sales tax.',
    es: 'Sin impuesto sobre ventas.',
  },
  guests: { pt: 'Convidados', en: 'Guests', es: 'Invitados' },
  adults: { pt: 'Adultos', en: 'Adults', es: 'Adultos' },
  children: { pt: 'Crianças', en: 'Children', es: 'Niños' },
  packageLine: { pt: 'Pacote', en: 'Package', es: 'Paquete' },
  additionals: { pt: 'Adicionais', en: 'Additionals', es: 'Adicionales' },
  garnishes: { pt: 'Guarnições', en: 'Sides', es: 'Guarniciones' },
  mileage: { pt: 'Quilometragem', en: 'Mileage', es: 'Millas' },
  grill: { pt: 'Grill', en: 'Grill', es: 'Parrilla' },
  discount: { pt: 'Desconto', en: 'Discount', es: 'Descuento' },
  seasonalSurcharge: {
    pt: 'Acréscimo sazonal',
    en: 'Seasonal surcharge',
    es: 'Recargo estacional',
  },
  subtotal: { pt: 'Subtotal', en: 'Subtotal', es: 'Subtotal' },
  eventDate: { pt: 'Data do evento', en: 'Event date', es: 'Fecha del evento' },
  eventAddress: { pt: 'Endereço', en: 'Event address', es: 'Dirección' },
  quoteNotAccepted: {
    pt: 'A cotação precisa estar aceita para gerar fatura.',
    en: 'The quote must be accepted before creating an invoice.',
    es: 'La cotización debe estar aceptada para generar la factura.',
  },
  generateError: {
    pt: 'Não foi possível gerar a fatura.',
    en: 'Could not generate the invoice.',
    es: 'No fue posible generar la factura.',
  },
  backofficeTitle: { pt: 'Faturas', en: 'Invoices', es: 'Facturas' },
  backofficeCount: { pt: 'faturas', en: 'invoices', es: 'facturas' },
  search: { pt: 'Buscar', en: 'Search', es: 'Buscar' },
  searchPlaceholder: {
    pt: 'Fatura, cotação, cliente ou evento',
    en: 'Invoice, quote, customer or event',
    es: 'Factura, presupuesto, cliente o evento',
  },
  filterStatus: { pt: 'Status', en: 'Status', es: 'Estado' },
  allStatuses: { pt: 'Todos os status', en: 'All statuses', es: 'Todos los estados' },
  sourceQuote: { pt: 'Cotação de origem', en: 'Source quote', es: 'Presupuesto de origen' },
  customerEvent: { pt: 'Cliente / evento', en: 'Customer / event', es: 'Cliente / evento' },
  event: { pt: 'Evento', en: 'Event', es: 'Evento' },
  date: { pt: 'Data', en: 'Date', es: 'Fecha' },
  actions: { pt: 'Ações', en: 'Actions', es: 'Acciones' },
  view: { pt: 'Ver', en: 'View', es: 'Ver' },
  noInvoices: {
    pt: 'Nenhuma fatura encontrada.',
    en: 'No invoices found.',
    es: 'No se encontraron facturas.',
  },
  totalReceivable: { pt: 'A receber', en: 'Receivable', es: 'Por cobrar' },
  capturedTotal: { pt: 'Recebido', en: 'Received', es: 'Recibido' },
  backToInvoices: { pt: 'Voltar para faturas', en: 'Back to invoices', es: 'Volver a facturas' },
  financialSummary: { pt: 'Resumo financeiro', en: 'Financial summary', es: 'Resumen financiero' },
  sourceAndEvent: { pt: 'Origem e evento', en: 'Source and event', es: 'Origen y evento' },
  customer: { pt: 'Cliente', en: 'Customer', es: 'Cliente' },
  email: { pt: 'E-mail', en: 'Email', es: 'Correo' },
  phone: { pt: 'Telefone', en: 'Phone', es: 'Teléfono' },
  paymentsHistory: { pt: 'Histórico de pagamentos', en: 'Payment history', es: 'Historial de pagos' },
  noPayments: {
    pt: 'Nenhuma tentativa de pagamento registrada.',
    en: 'No payment attempts recorded.',
    es: 'No hay intentos de pago registrados.',
  },
  provider: { pt: 'Forma', en: 'Provider', es: 'Medio' },
  purpose: { pt: 'Finalidade', en: 'Purpose', es: 'Finalidad' },
  capturedAt: { pt: 'Capturado em', en: 'Captured at', es: 'Capturado el' },
  createdAt: { pt: 'Criado em', en: 'Created at', es: 'Creado el' },
  reference: { pt: 'Referência', en: 'Reference', es: 'Referencia' },
  paymentLinks: { pt: 'Links de pagamento', en: 'Payment links', es: 'Enlaces de pago' },
  noPaymentLinks: {
    pt: 'Nenhum link de pagamento registrado.',
    en: 'No payment links recorded.',
    es: 'No hay enlaces de pago registrados.',
  },
  linkActive: { pt: 'Ativo', en: 'Active', es: 'Activo' },
  linkExpired: { pt: 'Expirado', en: 'Expired', es: 'Expirado' },
  linkRevoked: { pt: 'Revogado', en: 'Revoked', es: 'Revocado' },
  expiresAt: { pt: 'Expira em', en: 'Expires at', es: 'Expira el' },
  traceability: { pt: 'Rastreabilidade', en: 'Traceability', es: 'Trazabilidad' },
  traceabilityCopy: {
    pt: 'A fatura preserva um snapshot comercial da cotação. Pagamentos permanecem registros próprios e vinculados à mesma empresa e fatura.',
    en: 'The invoice preserves a commercial snapshot of the quote. Payments remain separate records linked to the same company and invoice.',
    es: 'La factura conserva una instantánea comercial del presupuesto. Los pagos permanecen como registros propios vinculados a la misma empresa y factura.',
  },
})

export const tPayments = t
export const listPaymentsI18nEntries = list

export function invoiceStatusLabel(
  status: string | null | undefined,
  locale: string | null | undefined,
): string {
  if (status === 'draft') return t(locale, 'statusDraft')
  if (status === 'ready') return t(locale, 'statusReady')
  if (status === 'awaiting_deposit') return t(locale, 'statusAwaitingDeposit')
  if (status === 'partially_paid') return t(locale, 'statusPartiallyPaid')
  if (status === 'paid') return t(locale, 'statusPaid')
  if (status === 'canceled') return t(locale, 'statusCanceled')
  return status || '—'
}

export function paymentStatusLabel(
  status: string | null | undefined,
  locale: string | null | undefined,
): string {
  if (status === 'created') return t(locale, 'paymentCreated')
  if (status === 'approved') return t(locale, 'paymentApproved')
  if (status === 'completed') return t(locale, 'paymentCompleted')
  if (status === 'failed') return t(locale, 'paymentFailed')
  if (status === 'canceled') return t(locale, 'paymentCanceled')
  return status || '—'
}

export function paymentPurposeLabel(
  purpose: string | null | undefined,
  locale: string | null | undefined,
): string {
  if (purpose === 'deposit') return t(locale, 'purposeDeposit')
  if (purpose === 'balance') return t(locale, 'purposeBalance')
  if (purpose === 'full') return t(locale, 'purposeFull')
  return purpose || '—'
}

export function paymentProviderLabel(
  provider: string | null | undefined,
  locale: string | null | undefined,
): string {
  if (provider === 'paypal') return t(locale, 'providerPaypal')
  if (provider === 'zelle') return t(locale, 'providerZelle')
  if (provider === 'bank_transfer') return t(locale, 'providerBankTransfer')
  return provider || '—'
}
