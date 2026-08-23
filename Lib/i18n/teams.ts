import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('teams', 'ui', {
  title: { pt: 'Equipes', en: 'Teams', es: 'Equipos' },
  subtitle: {
    pt: 'Recurso da agenda. O contato (telefone, e-mail, endereço, idioma) vem do cadastro único de Pessoas.',
    en: 'Agenda resource. Contact details (phone, email, address, language) come from the People address book.',
    es: 'Recurso de la agenda. El contacto (teléfono, correo, dirección, idioma) viene del registro único de Personas.',
  },
  searchPlaceholder: {
    pt: 'Buscar equipe ou contato…',
    en: 'Search team or contact…',
    es: 'Buscar equipo o contacto…',
  },
  newTeam: { pt: 'Nova equipe', en: 'New team', es: 'Nuevo equipo' },
  editTeam: {
    pt: 'Editar · {name}',
    en: 'Edit · {name}',
    es: 'Editar · {name}',
  },
  teamName: { pt: 'Nome da equipe', en: 'Team name', es: 'Nombre del equipo' },
  agendaColor: {
    pt: 'Cor na agenda',
    en: 'Agenda color',
    es: 'Color en la agenda',
  },
  contactPerson: {
    pt: 'Pessoa de contato *',
    en: 'Contact person *',
    es: 'Persona de contacto *',
  },
  selectPerson: {
    pt: 'Selecione a pessoa (cadastro único)…',
    en: 'Select the person (address book)…',
    es: 'Seleccione la persona (registro único)…',
  },
  contactHintBefore: {
    pt: 'Cadastre telefone, e-mail, endereço e idioma em',
    en: 'Register phone, email, address and language in',
    es: 'Registre teléfono, correo, dirección e idioma en',
  },
  peopleLink: { pt: 'Pessoas', en: 'People', es: 'Personas' },
  contactHintAfter: {
    pt: '(marque a flag Equipe). Sem pessoa vinculada não há WhatsApp/SMS/e-mail.',
    en: '(set the Team flag). Without a linked person there is no WhatsApp/SMS/email.',
    es: '(marque el rol Equipo). Sin persona vinculada no hay WhatsApp/SMS/correo.',
  },
  messageLanguage: {
    pt: 'Idioma das mensagens',
    en: 'Message language',
    es: 'Idioma de los mensajes',
  },
  empty: {
    pt: 'Nenhuma equipe cadastrada. Cadastre a primeira e vincule uma pessoa.',
    en: 'No teams registered. Create the first one and link a person.',
    es: 'Ningún equipo registrado. Cree el primero y vincule una persona.',
  },
  register: { pt: 'Cadastrar', en: 'Create', es: 'Registrar' },
  loadError: {
    pt: 'Falha ao carregar equipes',
    en: 'Failed to load teams',
    es: 'Error al cargar equipos',
  },
  createError: {
    pt: 'Falha ao criar',
    en: 'Failed to create',
    es: 'Error al crear',
  },
  saveError: {
    pt: 'Falha ao salvar',
    en: 'Failed to save',
    es: 'Error al guardar',
  },
  genericError: { pt: 'Erro', en: 'Error', es: 'Error' },
  noContact: {
    pt: 'Sem pessoa vinculada',
    en: 'No linked person',
    es: 'Sin persona vinculada',
  },
  activeTeam: { pt: 'Ativa', en: 'Active', es: 'Activa' },
  composition: { pt: 'Composição', en: 'Composition', es: 'Composición' },
  noMembers: {
    pt: 'Nenhum integrante. Comece pelo churrasqueiro.',
    en: 'No members yet. Start with the grill master.',
    es: 'Ningún integrante. Empiece por el parrillero.',
  },
  selectPersonShort: { pt: 'Pessoa…', en: 'Person…', es: 'Persona…' },
  designate: { pt: 'Designar', en: 'Assign', es: 'Designar' },
  loadMembersError: {
    pt: 'Falha ao carregar membros',
    en: 'Failed to load members',
    es: 'Error al cargar miembros',
  },
  addMemberError: {
    pt: 'Falha ao adicionar',
    en: 'Failed to add',
    es: 'Error al agregar',
  },
  removeMemberError: {
    pt: 'Falha ao remover',
    en: 'Failed to remove',
    es: 'Error al quitar',
  },
  scaleNoTeam: { pt: 'SEM EQUIPE', en: 'NO TEAM', es: 'SIN EQUIPO' },
  scaleIncomplete: {
    pt: 'EQUIPE INCOMPLETA',
    en: 'TEAM INCOMPLETE',
    es: 'EQUIPO INCOMPLETO',
  },
  scaleClosed: {
    pt: 'EQUIPE FECHADA',
    en: 'TEAM COMPLETE',
    es: 'EQUIPO CERRADO',
  },
  nextRole: {
    pt: 'próximo: {label}',
    en: 'next: {label}',
    es: 'siguiente: {label}',
  },
  pageLoadError: {
    pt: 'Erro ao carregar equipes',
    en: 'Failed to load teams',
    es: 'Error al cargar equipos',
  },
})

export const tTeams = t
export const listTeamsI18nEntries = list
