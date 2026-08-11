import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('agenda', 'ui', {
  title: {
    pt: 'Agenda de eventos',
    en: 'Events schedule',
    es: 'Agenda de eventos',
  },
  subtitle: {
    pt: 'Quadro semanal por equipe — análogo à Agenda da Frota do Logistics. Eventos entram aqui após aceite do cliente e confirmação do sinal (30%) na cotação.',
    en: 'Weekly board by team — analogous to Logistics Fleet Agenda. Events appear here after customer acceptance and the 30% deposit confirmation on the quote.',
    es: 'Tablero semanal por equipo — análogo a la Agenda de Flota de Logistics. Los eventos entran aquí tras el acepto del cliente y la confirmación de la seña (30%) en el presupuesto.',
  },
  manageTeams: {
    pt: 'Gerenciar equipes',
    en: 'Manage teams',
    es: 'Gestionar equipos',
  },
  newQuote: { pt: 'Nova cotação', en: 'New quote', es: 'Nuevo presupuesto' },
  workflowHintBefore: {
    pt: 'Não crie evento “na mão” na agenda. Use',
    en: 'Do not create events by hand on the agenda. Use',
    es: 'No cree eventos “a mano” en la agenda. Use',
  },
  workflowHintAfter: {
    pt: ': cliente → evento (adultos/crianças) → pacote → adicionais → resumo. Com aceite do cliente e confirmação do sinal (30%) na cotação, a data fecha aqui ao designar a equipe.',
    en: ': customer → event (adults/children) → package → extras → summary. After customer acceptance and the 30% deposit confirmation on the quote, the date closes here when the team is assigned.',
    es: ': cliente → evento (adultos/niños) → paquete → adicionales → resumen. Con el acepto del cliente y la confirmación de la seña (30%) en el presupuesto, la fecha se cierra aquí al designar el equipo.',
  },
  noTeamsBefore: {
    pt: 'Cadastre ao menos uma equipe em',
    en: 'Register at least one team in',
    es: 'Registre al menos un equipo en',
  },
  teamsLink: { pt: 'Equipes', en: 'Teams', es: 'Equipos' },
  noTeamsAfter: {
    pt: 'para montar a agenda.',
    en: 'to build the agenda.',
    es: 'para armar la agenda.',
  },
  prevWeek: {
    pt: '← Semana anterior',
    en: '← Previous week',
    es: '← Semana anterior',
  },
  today: { pt: 'Hoje', en: 'Today', es: 'Hoy' },
  nextWeek: {
    pt: 'Próxima semana →',
    en: 'Next week →',
    es: 'Próxima semana →',
  },
  allTeams: { pt: 'Todas', en: 'All', es: 'Todas' },
  viewMonth: { pt: 'Ver mês', en: 'View month', es: 'Ver mes' },
  from: { pt: 'De', en: 'From', es: 'Desde' },
  to: { pt: 'Até', en: 'To', es: 'Hasta' },
  applyPeriod: {
    pt: 'Aplicar período',
    en: 'Apply period',
    es: 'Aplicar período',
  },
  loadError: {
    pt: 'Falha ao carregar agenda',
    en: 'Failed to load agenda',
    es: 'Error al cargar la agenda',
  },
  invalidRange: {
    pt: 'Informe um intervalo válido (De ≤ Até).',
    en: 'Enter a valid range (From ≤ To).',
    es: 'Indique un intervalo válido (Desde ≤ Hasta).',
  },
  maxRange: {
    pt: 'Intervalo máximo: 366 dias.',
    en: 'Maximum range: 366 days.',
    es: 'Intervalo máximo: 366 días.',
  },
  genericError: { pt: 'Erro', en: 'Error', es: 'Error' },
  updateError: {
    pt: 'Falha ao atualizar',
    en: 'Failed to update',
    es: 'Error al actualizar',
  },
  nextAvailable: {
    pt: 'Próximo horário disponível: {time}',
    en: 'Next available time: {time}',
    es: 'Próximo horario disponible: {time}',
  },
  periodEventsTitle: {
    pt: 'Eventos no período ({count})',
    en: 'Events in period ({count})',
    es: 'Eventos en el período ({count})',
  },
  periodEventsHint: {
    pt: 'Lista do intervalo selecionado. O quadro abaixo continua semanal (semana do início do período).',
    en: 'List of the selected range. The board below stays weekly (week of the period start).',
    es: 'Lista del intervalo seleccionado. El tablero de abajo sigue semanal (semana del inicio del período).',
  },
  noPeriodEvents: {
    pt: 'Nenhum evento neste período.',
    en: 'No events in this period.',
    es: 'Ningún evento en este período.',
  },
  legendScheduled: {
    pt: 'Agendado (dia fechado)',
    en: 'Scheduled (day closed)',
    es: 'Agendado (día cerrado)',
  },
  legendCompleted: {
    pt: 'Concluído (dia fechado)',
    en: 'Completed (day closed)',
    es: 'Completado (día cerrado)',
  },
  legendFree: {
    pt: 'Livre — pode agendar',
    en: 'Free — can schedule',
    es: 'Libre — se puede agendar',
  },
  oneEventRule: {
    pt: 'Uma equipe só pode ter um evento por data. Se sábado estiver fechado, use domingo (se livre), dia útil ou feriado.',
    en: 'A team can have only one event per date. If Saturday is closed, use Sunday (if free), a weekday, or a holiday.',
    es: 'Un equipo solo puede tener un evento por fecha. Si el sábado está cerrado, use el domingo (si está libre), un día hábil o un feriado.',
  },
  dayFree: { pt: 'Livre o dia', en: 'Day free', es: 'Día libre' },
  openQuoteTitle: {
    pt: '{title} — abrir cotação',
    en: '{title} — open quote',
    es: '{title} — abrir presupuesto',
  },
  noEventsThisDay: {
    pt: 'Nenhum evento neste dia.',
    en: 'No events on this day.',
    es: 'Ningún evento en este día.',
  },
  openQuoteHint: {
    pt: 'Clique para abrir a cotação (pacote, convidados, adicionais e total).',
    en: 'Click to open the quote (package, guests, extras and total).',
    es: 'Haga clic para abrir el presupuesto (paquete, invitados, adicionales y total).',
  },
  noQuoteHint: {
    pt: 'Sem cotação vinculada — use Nova cotação (fluxo completo).',
    en: 'No linked quote — use New quote (full flow).',
    es: 'Sin presupuesto vinculado — use Nuevo presupuesto (flujo completo).',
  },
  viewQuote: { pt: 'Ver cotação', en: 'View quote', es: 'Ver presupuesto' },
  createQuote: {
    pt: 'Criar cotação',
    en: 'Create quote',
    es: 'Crear presupuesto',
  },
  complete: { pt: 'Concluir', en: 'Complete', es: 'Completar' },
  dayClosed: {
    pt: 'Dia fechado para esta equipe. Escolha outra data livre (domingo, dia útil ou feriado) ou outra equipe disponível.',
    en: 'This day is closed for this team. Choose another free date (Sunday, weekday or holiday) or another available team.',
    es: 'Día cerrado para este equipo. Elija otra fecha libre (domingo, día hábil o feriado) u otro equipo disponible.',
  },
  newQuoteOnDate: {
    pt: 'Nova cotação nesta data',
    en: 'New quote on this date',
    es: 'Nuevo presupuesto en esta fecha',
  },
  statusScheduled: { pt: 'Agendado', en: 'Scheduled', es: 'Agendado' },
  statusCompleted: { pt: 'Concluído', en: 'Completed', es: 'Completado' },
  statusCancelled: { pt: 'Cancelado', en: 'Cancelled', es: 'Cancelado' },
  pageLoadError: {
    pt: 'Erro ao carregar agenda',
    en: 'Failed to load agenda',
    es: 'Error al cargar la agenda',
  },
  migrationHint: {
    pt: 'Aplique a migration DEV `20260804120000_agenda_teams_events.sql` se ainda não existir.',
    en: 'Apply the DEV migration `20260804120000_agenda_teams_events.sql` if it does not exist yet.',
    es: 'Aplique la migration DEV `20260804120000_agenda_teams_events.sql` si aún no existe.',
  },
  closeTeamWhatsApp: {
    pt: 'Fechar WhatsApp equipe',
    en: 'Close team WhatsApp',
    es: 'Cerrar WhatsApp del equipo',
  },
  teamWhatsApp: {
    pt: 'WhatsApp equipe',
    en: 'Team WhatsApp',
    es: 'WhatsApp del equipo',
  },
  assignmentTitle: {
    pt: 'Designação da equipe — {team}',
    en: 'Team assignment — {team}',
    es: 'Designación del equipo — {team}',
  },
  presentationAt: {
    pt: 'Apresentação no local:',
    en: 'On-site presentation:',
    es: 'Presentación en el lugar:',
  },
  presentationMissing: {
    pt: 'Defina o horário de apresentação na cotação (após aceite do cliente) para incluir na mensagem.',
    en: 'Set the on-site presentation time on the quote (after customer acceptance) to include it in the message.',
    es: 'Defina el horario de presentación en el presupuesto (tras el acepto del cliente) para incluirlo en el mensaje.',
  },
  editBeforeSend: {
    pt: 'Edite o texto antes de enviar. O telefone fica salvo neste navegador.',
    en: 'Edit the text before sending. The phone number is saved in this browser.',
    es: 'Edite el texto antes de enviar. El teléfono queda guardado en este navegador.',
  },
  teamWhatsAppPhone: {
    pt: 'WhatsApp da equipe / líder',
    en: 'Team / leader WhatsApp',
    es: 'WhatsApp del equipo / líder',
  },
  phonePlaceholder: {
    pt: '+1 407 … ou (11) 9… ',
    en: '+1 407 … or (11) 9… ',
    es: '+1 407 … o (11) 9… ',
  },
  smsCopiedHint: {
    pt: 'Mensagem SMS copiada. No PC use Phone Link se disponível.',
    en: 'SMS message copied. On desktop use Phone Link if available.',
    es: 'Mensaje SMS copiado. En el PC use Phone Link si está disponible.',
  },
  emailUnavailable: {
    pt: 'E-mail indisponível',
    en: 'Email unavailable',
    es: 'Correo no disponible',
  },
  emailSubject: {
    pt: 'Designação {code} — {company}',
    en: 'Assignment {code} — {company}',
    es: 'Designación {code} — {company}',
  },
  destination: { pt: 'Destino', en: 'Destination', es: 'Destino' },
  phoneToEnableSend: {
    pt: 'Informe um telefone válido com DDI para liberar o envio.',
    en: 'Enter a valid phone number with country code to enable sending.',
    es: 'Indique un teléfono válido con código de país para habilitar el envío.',
  },
})

export const tAgenda = t
export const listAgendaI18nEntries = list
