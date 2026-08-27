import { makeI18nModule } from './makeModule.ts'
import { resolveUiLocale, type ProductLocale } from './locales.ts'

const { t, list } = makeI18nModule('publicOps', 'public', {
  proposalTitle: { pt: 'Proposta', en: 'Proposal', es: 'Propuesta' },
  proposalNotFound: {
    pt: 'Proposta não encontrada',
    en: 'Proposal not found',
    es: 'Propuesta no encontrada',
  },
  proposalNotFoundHint: {
    pt: 'O link pode estar incompleto ou a cotação foi desativada.',
    en: 'The link may be incomplete or the quote was deactivated.',
    es: 'El enlace puede estar incompleto o el presupuesto fue desactivado.',
  },
  quoteLabel: { pt: 'Cotação {number}', en: 'Quote {number}', es: 'Presupuesto {number}' },
  guestsLine: {
    pt: '{adults} adultos · {under3} ≤3 anos · {kids} de 4–12',
    en: '{adults} adults · {under3} ≤3 years · {kids} ages 4–12',
    es: '{adults} adultos · {under3} ≤3 años · {kids} de 4–12',
  },
  depositLabel: { pt: 'Sinal (reserva)', en: 'Deposit', es: 'Señal (reserva)' },
  balanceLabel: { pt: 'Saldo', en: 'Balance', es: 'Saldo' },
  proposalAccepted: {
    pt: 'Proposta aceita. Obrigado! Em breve entraremos em contato sobre o sinal e a agenda.',
    en: 'Proposal accepted. Thank you! We will contact you shortly about the deposit and schedule.',
    es: 'Propuesta aceptada. ¡Gracias! Pronto nos pondremos en contacto sobre la señal y la agenda.',
  },
  proposalRejected: {
    pt: 'Proposta recusada. Se quiser ajustar, fale conosco pelo WhatsApp.',
    en: 'Proposal declined. If you want to adjust it, contact us on WhatsApp.',
    es: 'Propuesta rechazada. Si desea ajustarla, hable con nosotros por WhatsApp.',
  },
  acceptProposal: { pt: 'Aceitar proposta', en: 'Accept proposal', es: 'Aceptar propuesta' },
  rejectProposal: { pt: 'Recusar proposta', en: 'Decline proposal', es: 'Rechazar propuesta' },
  respondError: { pt: 'Falha ao responder', en: 'Could not respond', es: 'No se pudo responder' },
  genericError: { pt: 'Erro', en: 'Error', es: 'Error' },

  assignmentTitle: { pt: 'Designação da equipe', en: 'Team assignment', es: 'Designación del equipo' },
  assignmentNotFound: {
    pt: 'Designação não encontrada',
    en: 'Assignment not found',
    es: 'Designación no encontrada',
  },
  assignmentNotFoundHint: {
    pt: 'O link pode estar incompleto ou a designação foi cancelada.',
    en: 'The link may be incomplete or the assignment was cancelled.',
    es: 'El enlace puede estar incompleto o la designación fue cancelada.',
  },
  quoteSuffix: { pt: ' · Cotação {number}', en: ' · Quote {number}', es: ' · Presupuesto {number}' },
  presentationTime: {
    pt: 'Horário de apresentação no local',
    en: 'On-site presentation time',
    es: 'Horario de presentación en el lugar',
  },
  eventTime: { pt: 'Horário do evento', en: 'Event time', es: 'Horario del evento' },
  acceptedAssignment: {
    pt: 'Você aceitou esta designação.',
    en: 'You accepted this assignment.',
    es: 'Aceptó esta designación.',
  },
  rejectedAssignment: {
    pt: 'Você recusou esta designação.',
    en: 'You declined this assignment.',
    es: 'Rechazó esta designación.',
  },
  awaitingYourConfirmation: {
    pt: 'Aguardando sua confirmação.',
    en: 'Awaiting your confirmation.',
    es: 'Esperando su confirmación.',
  },
  acceptAssignment: { pt: 'Aceitar designação', en: 'Accept assignment', es: 'Aceptar designación' },
  decline: { pt: 'Recusar', en: 'Decline', es: 'Rechazar' },

  memberConfirmTitle: { pt: 'Confirmação de escala', en: 'Roster confirmation', es: 'Confirmación de escala' },
  memberConfirmNotFound: {
    pt: 'Confirmação não encontrada',
    en: 'Confirmation not found',
    es: 'Confirmación no encontrada',
  },
  memberConfirmNotFoundHint: {
    pt: 'O link pode estar incompleto, expirado ou revogado.',
    en: 'The link may be incomplete, expired, or revoked.',
    es: 'El enlace puede estar incompleto, vencido o revocado.',
  },
  linkExpired: { pt: 'Link expirado', en: 'Expired link', es: 'Enlace vencido' },
  linkExpiredHint: {
    pt: 'Solicite um novo convite à operação.',
    en: 'Ask operations for a new invite.',
    es: 'Solicite una nueva invitación a la operación.',
  },
  roleLabel: { pt: 'Função', en: 'Role', es: 'Función' },
  memberLabel: { pt: 'Integrante', en: 'Member', es: 'Integrante' },
  participationConfirmed: {
    pt: 'Participação confirmada. Obrigado!',
    en: 'Participation confirmed. Thank you!',
    es: 'Participación confirmada. ¡Gracias!',
  },
  unavailabilityRecorded: {
    pt: 'Indisponibilidade registrada.',
    en: 'Unavailability recorded.',
    es: 'Indisponibilidad registrada.',
  },
  inviteCancelled: {
    pt: 'Este convite foi cancelado.',
    en: 'This invite was cancelled.',
    es: 'Esta invitación fue cancelada.',
  },
  confirmParticipation: {
    pt: 'Confirmar participação',
    en: 'Confirm participation',
    es: 'Confirmar participación',
  },
  cannotParticipate: {
    pt: 'Não posso participar',
    en: 'I cannot participate',
    es: 'No puedo participar',
  },
  registerResponseError: {
    pt: 'Não foi possível registrar a resposta.',
    en: 'Could not register the response.',
    es: 'No fue posible registrar la respuesta.',
  },
  networkRetry: {
    pt: 'Falha de rede. Tente novamente.',
    en: 'Network error. Try again.',
    es: 'Error de red. Intente de nuevo.',
  },

  garnishOrderTitle: { pt: 'Pedido de guarnição', en: 'Sides order', es: 'Pedido de guarnición' },
  garnishOrderNotFound: {
    pt: 'Pedido não encontrado',
    en: 'Order not found',
    es: 'Pedido no encontrado',
  },
  garnishOrderNotFoundHint: {
    pt: 'O link pode estar incompleto ou o pedido foi cancelado.',
    en: 'The link may be incomplete or the order was cancelled.',
    es: 'El enlace puede estar incompleto o el pedido fue cancelado.',
  },
  serviceOrderLabel: { pt: 'OS {number}', en: 'SO {number}', es: 'OS {number}' },
  pickupTime: { pt: 'Horário de retirada', en: 'Pickup time', es: 'Horario de retiro' },
  receiptConfirmed: {
    pt: 'Recebimento confirmado. Obrigado!',
    en: 'Receipt confirmed. Thank you!',
    es: 'Recepción confirmada. ¡Gracias!',
  },
  awaitingReceipt: {
    pt: 'Aguardando confirmação de recebimento do pedido.',
    en: 'Awaiting confirmation of order receipt.',
    es: 'Esperando confirmación de recepción del pedido.',
  },
  confirmReceipt: {
    pt: 'Confirmar recebimento',
    en: 'Confirm receipt',
    es: 'Confirmar recepción',
  },
  confirmError: { pt: 'Falha ao confirmar', en: 'Could not confirm', es: 'No se pudo confirmar' },

  quoteRequestTitle: { pt: 'Solicitar cotação', en: 'Request a quote', es: 'Solicitar presupuesto' },
  quoteRequestSubtitle: {
    pt: 'Portal público em preparação. Em breve: idioma, telefone e dados do evento para iniciar uma cotação personalizada.',
    en: 'Public portal in preparation. Coming soon: language, phone and event details to start a personalized quote.',
    es: 'Portal público en preparación. Pronto: idioma, teléfono y datos del evento para iniciar un presupuesto personalizado.',
  },
  quoteRequestPlanned: {
    pt: 'Estrutura planejada para esta fase:',
    en: 'Planned structure for this phase:',
    es: 'Estructura planificada para esta fase:',
  },
  quoteRequestItemLang: {
    pt: 'Seleção de idioma (PT / EN / ES)',
    en: 'Language selection (PT / EN / ES)',
    es: 'Selección de idioma (PT / EN / ES)',
  },
  quoteRequestItemPhone: {
    pt: 'Identificação por telefone (chave do cliente)',
    en: 'Identification by phone (customer key)',
    es: 'Identificación por teléfono (clave del cliente)',
  },
  quoteRequestItemEvent: {
    pt: 'Dados básicos do evento',
    en: 'Basic event details',
    es: 'Datos básicos del evento',
  },
  quoteRequestItemNext: {
    pt: 'Encaminhamento para revisão interna ou wizard',
    en: 'Handoff to internal review or wizard',
    es: 'Derivación a revisión interna o asistente',
  },
  quoteRequestTodo: {
    pt: 'TODO: implementar formulário público completo na próxima fase.',
    en: 'TODO: implement the full public form in the next phase.',
    es: 'TODO: implementar el formulario público completo en la próxima fase.',
  },
  newQuoteStaff: {
    pt: 'Nova cotação (equipe)',
    en: 'New quote (staff)',
    es: 'Nuevo presupuesto (equipo)',
  },
  viewCustomerPage: {
    pt: 'Ver página do cliente',
    en: 'View customer page',
    es: 'Ver página del cliente',
  },

  customerQuoteEyebrow: {
    pt: 'BBQ AT HOME · CDL',
    en: 'BBQ AT HOME · CDL',
    es: 'BBQ AT HOME · CDL',
  },
  customerQuoteTitle: {
    pt: 'Entenda como funciona',
    en: 'See how it works',
    es: 'Entienda cómo funciona',
  },
  customerQuoteIntro: {
    pt: 'Antes de iniciar sua cotação, conheça o serviço, os pacotes e as regras comerciais da CDL.',
    en: 'Before starting your quote, learn about the service, packages and CDL commercial rules.',
    es: 'Antes de iniciar su presupuesto, conozca el servicio, los paquetes y las reglas comerciales de CDL.',
  },
  startMyQuote: {
    pt: 'Iniciar minha cotação',
    en: 'Start my quote',
    es: 'Iniciar mi presupuesto',
  },
  backHome: { pt: 'Voltar ao início', en: 'Back to home', es: 'Volver al inicio' },
  sectionHowItWorks: {
    pt: 'Como funciona o serviço',
    en: 'How the service works',
    es: 'Cómo funciona el servicio',
  },
  sectionChoosePackage: {
    pt: 'Escolha o pacote',
    en: 'Choose the package',
    es: 'Elija el paquete',
  },
  sectionSides: {
    pt: 'Escolha com ou sem guarnições',
    en: 'Choose with or without sides',
    es: 'Elija con o sin guarniciones',
  },
  sectionExtras: {
    pt: 'Adicione itens extras',
    en: 'Add extra items',
    es: 'Agregue ítems extra',
  },
  sectionEventData: {
    pt: 'Informe os dados do evento',
    en: 'Enter the event details',
    es: 'Indique los datos del evento',
  },
  sectionGrill: {
    pt: 'Informe churrasqueira e estrutura',
    en: 'Tell us about the grill and setup',
    es: 'Indique parrilla y estructura',
  },
  sectionMileage: {
    pt: 'Milhagem e deslocamento',
    en: 'Mileage and travel',
    es: 'Kilometraje y desplazamiento',
  },
  sectionDeposit: {
    pt: 'Reserva de 30%',
    en: '30% deposit',
    es: 'Reserva del 30%',
  },
  sectionRules: {
    pt: 'Regras importantes',
    en: 'Important rules',
    es: 'Reglas importantes',
  },
  sectionHoliday: {
    pt: 'Adicional de datas comemorativas',
    en: 'Commemorative dates surcharge',
    es: 'Adicional de fechas conmemorativas',
  },
  sectionCancel: {
    pt: 'Política de cancelamento',
    en: 'Cancellation policy',
    es: 'Política de cancelación',
  },
  sectionStart: {
    pt: 'Iniciar cotação',
    en: 'Start quote',
    es: 'Iniciar presupuesto',
  },
  howHours: {
    pt: 'Serviço de churrasco no formato buffet / all you can eat, por até {hours} horas.',
    en: 'BBQ buffet / all-you-can-eat service for up to {hours} hours.',
    es: 'Servicio de BBQ tipo buffet / all you can eat por hasta {hours} horas.',
  },
  howNoDrinks: {
    pt: 'Não trabalhamos com bebidas.',
    en: 'We do not provide drinks.',
    es: 'No trabajamos con bebidas.',
  },
  howWaiter: {
    pt: 'Serviço de garçom opcional: ${amount}.',
    en: 'Optional waiter service: ${amount}.',
    es: 'Servicio de camarero opcional: ${amount}.',
  },
  howGrill: {
    pt: 'Churrasqueira não inclusa — aluguel ${amount}.',
    en: 'Grill not included — rental ${amount}.',
    es: 'Parrilla no incluida — alquiler ${amount}.',
  },
  howChildren: {
    pt: 'Crianças até {free} anos não pagam; até {half} anos pagam meia.',
    en: 'Children up to {free} years are free; up to {half} years pay half.',
    es: 'Niños hasta {free} años no pagan; hasta {half} años pagan mitad.',
  },
  sidesExtra: {
    pt: 'Guarnições adicionais: +${amount}/pessoa.',
    en: 'Additional sides: +${amount}/person.',
    es: 'Guarniciones adicionales: +${amount}/persona.',
  },
  extrasBody1: {
    pt: 'Personalize seu evento com cortes premium, acompanhamentos e equipamentos.',
    en: 'Customize your event with premium cuts, sides and equipment.',
    es: 'Personalice su evento con cortes premium, acompañamientos y equipos.',
  },
  extrasBody2: {
    pt: 'Os valores dos adicionais são calculados na cotação.',
    en: 'Extra item prices are calculated on the quote.',
    es: 'Los valores de los adicionales se calculan en el presupuesto.',
  },
  eventDataBody: {
    pt: 'Data, horário, local, endereço e número de convidados (adultos e crianças).',
    en: 'Date, time, venue, address and guest count (adults and children).',
    es: 'Fecha, horario, lugar, dirección y número de invitados (adultos y niños).',
  },
  grillBody: {
    pt: 'Informe se há churrasqueira no local, se foto é necessária e se aluguel é requerido.',
    en: 'Tell us if there is a grill on site, whether a photo is needed and if rental is required.',
    es: 'Indique si hay parrilla en el lugar, si se necesita foto y si se requiere alquiler.',
  },
  grillRentalLine: {
    pt: 'Aluguel de churrasqueira: ${amount}.',
    en: 'Grill rental: ${amount}.',
    es: 'Alquiler de parrilla: ${amount}.',
  },
  startQuoteBody: {
    pt: 'Revise as informações acima e inicie sua cotação personalizada.',
    en: 'Review the information above and start your personalized quote.',
    es: 'Revise la información anterior e inicie su presupuesto personalizado.',
  },
  supplierLabel: { pt: 'Fornecedor', en: 'Supplier', es: 'Proveedor' },
  guestsLabel: { pt: 'Convidados', en: 'Guests', es: 'Invitados' },
  invalidToken: { pt: 'Token inválido', en: 'Invalid token', es: 'Token inválido' },
})

export const tPublicOps = t
export const listPublicOpsI18nEntries = list

export function resolveBrowserLocale(
  value?: string | null,
): ProductLocale {
  return resolveUiLocale(value)
}
