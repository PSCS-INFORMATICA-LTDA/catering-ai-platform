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
  customerWhatsApp: {
    pt: 'WhatsApp do cliente',
    en: 'Customer WhatsApp',
    es: 'WhatsApp del cliente',
  },
  sendDepositWhatsApp: {
    pt: 'Enviar sinal no WhatsApp',
    en: 'Send deposit on WhatsApp',
    es: 'Enviar depósito por WhatsApp',
  },
  sendBalanceWhatsApp: {
    pt: 'Enviar saldo no WhatsApp',
    en: 'Send balance on WhatsApp',
    es: 'Enviar saldo por WhatsApp',
  },
  sendFullWhatsApp: {
    pt: 'Enviar pagamento total no WhatsApp',
    en: 'Send full payment on WhatsApp',
    es: 'Enviar pago total por WhatsApp',
  },
  whatsappShareHint: {
    pt: 'Abriremos o WhatsApp disponível no seu dispositivo. A mensagem não é enviada automaticamente.',
    en: 'We will open the WhatsApp available on your device. The message is not sent automatically.',
    es: 'Abriremos el WhatsApp disponible en tu dispositivo. El mensaje no se envía automáticamente.',
  },
  awaitingCustomerAcceptance: {
    pt: 'Aguardando aceite do cliente',
    en: 'Awaiting customer acceptance',
    es: 'Esperando aceptación del cliente',
  },
  copyPaymentMessage: {
    pt: 'Copiar mensagem',
    en: 'Copy message',
    es: 'Copiar mensaje',
  },
  paymentMessageCopied: {
    pt: 'Mensagem copiada.',
    en: 'Message copied.',
    es: 'Mensaje copiado.',
  },
  paymentLinkCopied: {
    pt: 'Link copiado.',
    en: 'Link copied.',
    es: 'Enlace copiado.',
  },
  missingCustomerWhatsApp: {
    pt: 'Cliente sem WhatsApp válido cadastrado.',
    en: 'Customer has no valid WhatsApp on file.',
    es: 'El cliente no tiene un WhatsApp válido registrado.',
  },
  showPaymentUrl: {
    pt: 'Mostrar URL',
    en: 'Show URL',
    es: 'Mostrar URL',
  },
  hidePaymentUrl: {
    pt: 'Ocultar URL',
    en: 'Hide URL',
    es: 'Ocultar URL',
  },
  ogPaymentDescription: {
    pt: 'Pagamento seguro da sua cotação.',
    en: 'Secure payment for your catering quote.',
    es: 'Pago seguro de tu cotización.',
  },
  lastShareDeposit: {
    pt: 'Mensagem do sinal pronta',
    en: 'Deposit message ready',
    es: 'Mensaje del depósito listo',
  },
  lastShareBalance: {
    pt: 'Mensagem do saldo pronta',
    en: 'Balance message ready',
    es: 'Mensaje del saldo listo',
  },
  lastShareFull: {
    pt: 'Mensagem do pagamento total pronta',
    en: 'Full payment message ready',
    es: 'Mensaje del pago total listo',
  },
  generateShareFirst: {
    pt: 'Gere o sinal ou o saldo para copiar.',
    en: 'Generate the deposit or balance first to copy.',
    es: 'Genere el depósito o el saldo para copiar.',
  },
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
  paypalSandboxBuyerNotice: {
    pt: 'PayPal Sandbox — use uma conta de comprador Sandbox. Credenciais PayPal reais não funcionam neste ambiente.',
    en: 'PayPal Sandbox — use a Sandbox buyer account. Real PayPal credentials do not work in this environment.',
    es: 'PayPal Sandbox — use una cuenta de comprador Sandbox. Las credenciales reales de PayPal no funcionan en este entorno.',
  },
  paypalSandboxCancelled: {
    pt: 'Pagamento Sandbox cancelado. Você pode tentar de novo.',
    en: 'Sandbox payment cancelled. You can try again.',
    es: 'Pago Sandbox cancelado. Puede intentarlo de nuevo.',
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
  children4To12: {
    pt: 'Crianças 4–12',
    en: 'Children 4–12',
    es: 'Niños 4–12',
  },
  childrenUnder3: {
    pt: 'Crianças 0–3',
    en: 'Children 0–3',
    es: 'Niños 0–3',
  },
  billableGuests: {
    pt: 'Equivalente faturável',
    en: 'Billable guest equivalent',
    es: 'Equivalente facturable',
  },
  physicalGuests: {
    pt: 'Convidados físicos',
    en: 'Physical guests',
    es: 'Invitados físicos',
  },
  packageLine: { pt: 'Pacote', en: 'Package', es: 'Paquete' },
  packageUnitPrice: {
    pt: 'Preço unitário do pacote',
    en: 'Package unit price',
    es: 'Precio unitario del paquete',
  },
  additionals: { pt: 'Adicionais', en: 'Additionals', es: 'Adicionales' },
  garnishes: { pt: 'Guarnições', en: 'Sides', es: 'Guarniciones' },
  garnishesIncluded: {
    pt: 'Guarnições — incluídas',
    en: 'Sides — included',
    es: 'Guarniciones — incluidas',
  },
  included: { pt: 'Incluído', en: 'Included', es: 'Incluido' },
  mileage: { pt: 'Quilometragem', en: 'Mileage', es: 'Millas' },
  mileageDistance: {
    pt: 'Distância considerada',
    en: 'Distance considered',
    es: 'Distancia considerada',
  },
  mileageIncluded: {
    pt: 'Limite de cortesia',
    en: 'Courtesy threshold',
    es: 'Límite de cortesía',
  },
  mileageCourtesyValue: {
    pt: 'até {n} mi',
    en: 'up to {n} mi',
    es: 'hasta {n} mi',
  },
  mileageCourtesyHelp: {
    pt: 'Até {n} mi, não há cobrança de quilometragem. Acima desse limite, a distância total considerada do trajeto é faturada.',
    en: 'Up to {n} mi, there is no mileage charge. Above that threshold, the full considered trip distance is billed.',
    es: 'Hasta {n} mi no se cobra kilometraje. Por encima de ese límite, se factura la distancia total considerada del trayecto.',
  },
  mileageChargeable: {
    pt: 'Distância faturável do trajeto',
    en: 'Billable trip distance',
    es: 'Distancia facturable del trayecto',
  },
  mileageRate: {
    pt: 'Tarifa',
    en: 'Rate',
    es: 'Tarifa',
  },
  mileageTotal: {
    pt: 'Total de quilometragem',
    en: 'Mileage total',
    es: 'Total de millas',
  },
  mileageFullTrip: {
    pt: 'A distância faturável já representa o trajeto completo (ida e volta). O limite de cortesia não é subtraído da quilometragem cobrada.',
    en: 'The billable distance already represents the full trip (round trip). The courtesy threshold is not subtracted from the billed mileage.',
    es: 'La distancia facturable ya representa el trayecto completo (ida y vuelta). El límite de cortesía no se resta del kilometraje cobrado.',
  },
  grill: { pt: 'Grill', en: 'Grill', es: 'Parrilla' },
  minimumAdjustment: {
    pt: 'Ajuste de pedido mínimo',
    en: 'Minimum order adjustment',
    es: 'Ajuste de pedido mínimo',
  },
  discount: { pt: 'Desconto', en: 'Discount', es: 'Descuento' },
  couponCode: { pt: 'Cupom', en: 'Coupon', es: 'Cupón' },
  baseBeforeDiscount: {
    pt: 'Base antes do desconto',
    en: 'Base before discount',
    es: 'Base antes del descuento',
  },
  finalContractTotal: {
    pt: 'Total final do contrato',
    en: 'Final contract total',
    es: 'Total final del contrato',
  },
  depositCalculationBase: {
    pt: 'Base de cálculo do sinal',
    en: 'Deposit calculation base',
    es: 'Base de cálculo de la seña',
  },
  depositPercentage: {
    pt: 'Percentual do sinal',
    en: 'Deposit percentage',
    es: 'Porcentaje de la seña',
  },
  discountAllocatedToDeposit: {
    pt: 'Desconto alocado no sinal',
    en: 'Discount allocated to deposit',
    es: 'Descuento asignado a la seña',
  },
  discountAllocatedToBalance: {
    pt: 'Desconto alocado no saldo',
    en: 'Discount allocated to balance',
    es: 'Descuento asignado al saldo',
  },
  couponDoesNotApplyToDeposit: {
    pt: 'Este cupom não reduz o sinal. O desconto permanece no saldo contratual.',
    en: 'This coupon does not reduce the deposit. The discount stays on the contract balance.',
    es: 'Este cupón no reduce la seña. El descuento permanece en el saldo contractual.',
  },
  couponAppliesToDeposit: {
    pt: 'Este cupom também se aplica ao sinal.',
    en: 'This coupon also applies to the deposit.',
    es: 'Este cupón también se aplica a la seña.',
  },
  originalContract: {
    pt: 'Contrato original',
    en: 'Original contract',
    es: 'Contrato original',
  },
  postEventAdjustment: {
    pt: 'Ajuste pós-evento',
    en: 'Post-event adjustment',
    es: 'Ajuste postevento',
  },
  finalEventCost: {
    pt: 'Custo final do evento',
    en: 'Final event cost',
    es: 'Costo final del evento',
  },
  financialBreakdown: {
    pt: 'Detalhamento financeiro',
    en: 'Financial breakdown',
    es: 'Desglose financiero',
  },
  contractReconciliation: {
    pt: 'Conciliação do contrato',
    en: 'Contract reconciliation',
    es: 'Conciliación del contrato',
  },
  balanceLockedUntil: {
    pt: 'Saldo disponível a partir de {when}',
    en: 'Balance available from {when}',
    es: 'Saldo disponible a partir de {when}',
  },
  balanceNotAvailableYet: {
    pt: 'O saldo contratual só é liberado no início do evento.',
    en: 'The contractual balance is released at event start.',
    es: 'El saldo contractual se libera al inicio del evento.',
  },
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
