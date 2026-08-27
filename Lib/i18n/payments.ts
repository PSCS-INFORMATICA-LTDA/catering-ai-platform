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
  payDeposit: { pt: 'Pagar sinal (30%)', en: 'Pay deposit (30%)', es: 'Pagar seña (30%)' },
  payBalance: { pt: 'Pagar saldo (70%)', en: 'Pay balance (70%)', es: 'Pagar saldo (70%)' },
  createPaymentLink: {
    pt: 'Criar link seguro',
    en: 'Create secure link',
    es: 'Crear enlace seguro',
  },
  copyLink: { pt: 'Copiar link', en: 'Copy link', es: 'Copiar enlace' },
  downloadPdf: { pt: 'Baixar PDF', en: 'Download PDF', es: 'Descargar PDF' },
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
  publicPayTitle: {
    pt: 'Pagamento da fatura',
    en: 'Invoice payment',
    es: 'Pago de la factura',
  },
  invoiceSummary: { pt: 'Resumo da fatura', en: 'Invoice summary', es: 'Resumen de la factura' },
  total: { pt: 'Total', en: 'Total', es: 'Total' },
  deposit: { pt: 'Sinal', en: 'Deposit', es: 'Seña' },
  balance: { pt: 'Saldo', en: 'Balance', es: 'Saldo' },
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
})

export const tPayments = t
export const listPaymentsI18nEntries = list
