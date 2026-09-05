import type { BrasinhaLanguage } from '../types.ts'
import type { PublicRulesSnapshot } from '../tools/types.ts'
import type { BrasinhaQuoteDraft } from './draft.ts'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function shiftTime(hhmm: string, minutes: number): string | null {
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const mins = Number(match[2])
  if (hours > 23 || mins > 59) return null
  const total = (hours * 60 + mins + minutes + 24 * 60) % (24 * 60)
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

export function serviceWindow(startTime: string | null, rules: PublicRulesSnapshot | null) {
  if (!startTime) return { start: null, setup: null, end: null }
  const durationHours = rules?.serviceDurationHours ?? 4
  const setupLead = rules?.crewSetupLeadMinutes ?? 60
  return {
    start: startTime,
    setup: shiftTime(startTime, -setupLead),
    end: shiftTime(startTime, durationHours * 60),
    durationHours,
    setupLead,
  }
}

export function formatReviewReply(
  draft: BrasinhaQuoteDraft,
  language: BrasinhaLanguage,
  rules: PublicRulesSnapshot | null,
): string {
  const window = serviceWindow(draft.event.startTime, rules)
  const name = draft.contact.firstName || (language === 'en' ? 'there' : language === 'es' ? 'hola' : 'olá')
  const location =
    draft.event.formattedAddress ||
    [draft.event.address, draft.event.city, draft.event.state, draft.event.zipCode]
      .filter(Boolean)
      .join(', ') ||
    '—'
  const children = `${draft.event.childrenUnder3Count ?? 0} (<=3) / ${draft.event.children4To12Count ?? 0} (4–12)`
  const grill =
    draft.grill.hasGrill === true
      ? language === 'en'
        ? 'own grill (photo can be sent later)'
        : language === 'es'
          ? 'parrilla propia (foto después)'
          : 'própria (foto pode ser enviada depois)'
      : language === 'en'
        ? 'rental required'
        : language === 'es'
          ? 'alquiler necesario'
          : 'aluguel necessário'
  const extras = draft.additionals.length
    ? draft.additionals.map((row) => `${row.itemKey || row.itemId} x${row.quantity}`).join(', ')
    : '—'
  const options = Object.values(draft.package.packageSelections).join(', ') || '—'
  if (language === 'en') {
    return [
      `${name}, please check if I understood correctly:`,
      `Date: ${draft.event.eventDate ?? '—'}`,
      `Service start: ${window.start ?? '—'}`,
      `Crew arrives for setup: approximately ${window.setup ?? '—'}`,
      `Adults: ${draft.event.adultCount ?? '—'}`,
      `Children: ${children}`,
      `Location: ${location}`,
      `Package: ${draft.package.packageName ?? '—'}`,
      `Package options: ${options}`,
      `Additionals: ${extras}`,
      `Grill: ${grill}`,
      `Waiters: ${draft.service.waiterQty ?? 0}`,
      `Standard service duration is up to ${window.durationHours} hours (ends around ${window.end ?? '—'}).`,
      'Is everything correct?',
    ].join('\n')
  }
  if (language === 'es') {
    return [
      `${name}, confirma si entendí bien:`,
      `Fecha: ${draft.event.eventDate ?? '—'}`,
      `Inicio del servicio: ${window.start ?? '—'}`,
      `El equipo llega para montaje: aproximadamente ${window.setup ?? '—'}`,
      `Adultos: ${draft.event.adultCount ?? '—'}`,
      `Niños: ${children}`,
      `Lugar: ${location}`,
      `Paquete: ${draft.package.packageName ?? '—'}`,
      `Opciones: ${options}`,
      `Adicionales: ${extras}`,
      `Parrilla: ${grill}`,
      `Meseros: ${draft.service.waiterQty ?? 0}`,
      `El servicio dura hasta ${window.durationHours} horas (termina cerca de ${window.end ?? '—'}).`,
      '¿Está todo correcto?',
    ].join('\n')
  }
  return [
    `${name}, confira se entendi corretamente:`,
    `Data: ${draft.event.eventDate ?? '—'}`,
    `Início do serviço: ${window.start ?? '—'}`,
    `Equipe chega para montagem: aproximadamente ${window.setup ?? '—'}`,
    `Adultos: ${draft.event.adultCount ?? '—'}`,
    `Crianças: ${children}`,
    `Local: ${location}`,
    `Pacote: ${draft.package.packageName ?? '—'}`,
    `Opções do pacote: ${options}`,
    `Adicionais: ${extras}`,
    `Churrasqueira: ${grill}`,
    `Garçons: ${draft.service.waiterQty ?? 0}`,
    `O serviço tem duração padrão de até ${window.durationHours} horas (término por volta de ${window.end ?? '—'}).`,
    'Está tudo correto?',
  ].join('\n')
}

export function nextIntakePrompt(
  draft: BrasinhaQuoteDraft,
  language: BrasinhaLanguage,
): string {
  const missing = draft.conversation.missingFields
  const pending = draft.conversation.pendingAction
  if (pending?.type === 'confirm_package') {
    return language === 'en'
      ? `Would you like to continue with ${pending.packageName}?`
      : language === 'es'
        ? `¿Seguimos con ${pending.packageName}?`
        : `Quer seguir com o ${pending.packageName}?`
  }
  if (pending?.type === 'confirm_children_bands') {
    return language === 'en'
      ? 'Just confirming: no children 3 or under, and none aged 4 to 12, right?'
      : language === 'es'
        ? 'Solo confirmando: ningún niño de hasta 3 años y ninguno de 4 a 12, ¿cierto?'
        : 'Perfeito. Só confirmando: nenhuma criança de até 3 anos e nenhuma de 4 a 12, certo?'
  }
  if (pending?.type === 'confirm_review' || draft.conversation.readyForReview) {
    return language === 'en'
      ? 'The request is ready for review. Shall I recap?'
      : 'A solicitação está pronta para revisão. Quer que eu recapitulhe?'
  }
  if (missing.includes('event.eventDate') || missing.includes('event.startTime')) {
    return language === 'en'
      ? 'What date and start time work for the event?'
      : 'Para qual data e horário de início?'
  }
  if (missing.includes('event.adultCount')) {
    return language === 'en' ? 'How many adults?' : 'Quantos adultos?'
  }
  if (missing.includes('event.address')) {
    return language === 'en'
      ? 'Where will the event be? I need a real address or at least the city.'
      : 'Onde será o evento? Preciso de um local real ou pelo menos a cidade.'
  }
  if (missing.includes('package.confirmed')) {
    return language === 'en'
      ? 'Which package would you like to follow?'
      : 'Qual pacote você quer seguir?'
  }
  if (missing.includes('package.packageSelections')) {
    return language === 'en'
      ? 'This package has required options. Which choice do you prefer?'
      : 'Esse pacote tem opções obrigatórias. Qual escolha você prefere?'
  }
  if (missing.includes('grill.setupAnswered')) {
    return language === 'en'
      ? 'Does the venue have a suitable grill?'
      : 'Você possui churrasqueira adequada no local do evento?'
  }
  if (missing.includes('service.waiter')) {
    return language === 'en'
      ? 'Would you like to include waiter service?'
      : 'Você gostaria de incluir serviço de garçom?'
  }
  if (
    missing.includes('contact.firstName') ||
    missing.includes('contact.lastName') ||
    missing.includes('contact.phone')
  ) {
    return language === 'en'
      ? 'May I have your full name and phone to continue?'
      : 'Posso anotar seu nome completo e telefone para seguir?'
  }
  return language === 'en'
    ? 'I can continue with the next quote detail.'
    : 'Posso seguir com o próximo detalhe da cotação.'
}

export function readyToCreateQuoteReply(language: BrasinhaLanguage): string {
  if (language === 'en') {
    return 'Perfect. Your request is ready to be created. In this version the quote is not created yet — that is the next step.'
  }
  if (language === 'es') {
    return 'Perfecto. Tu solicitud está lista para ser creada. En esta versión la cotización todavía no se crea — eso es el siguiente paso.'
  }
  return 'Perfeito. Sua solicitação está pronta para ser criada. Nesta versão a cotação ainda não é criada — isso fica para a próxima etapa.'
}
