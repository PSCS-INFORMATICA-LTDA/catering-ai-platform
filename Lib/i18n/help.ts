import { makeI18nModule } from './makeModule.ts'
import type { AuthLocale } from './authUsers.ts'

const { t, list } = makeI18nModule('help', 'ui', {
  help: { pt: 'Ajuda', en: 'Help', es: 'Ayuda' },
  helpCenter: {
    pt: 'Central de ajuda',
    en: 'Help center',
    es: 'Central de ayuda',
  },
  contextualHelp: {
    pt: 'Ajuda contextual para esta tela',
    en: 'Contextual help for this screen',
    es: 'Ayuda contextual para esta pantalla',
  },
  closeHelp: { pt: 'Fechar ajuda', en: 'Close help', es: 'Cerrar ayuda' },
  response: { pt: 'Resposta', en: 'Reply', es: 'Respuesta' },
  quickChecklist: {
    pt: 'Checklist rápido',
    en: 'Quick checklist',
    es: 'Checklist rápido',
  },
  helpDialog: {
    pt: 'Ajuda do sistema',
    en: 'System help',
    es: 'Ayuda del sistema',
  },
  onlineNow: { pt: 'online agora', en: 'online now', es: 'en línea ahora' },
  openHelp: { pt: 'Abrir ajuda', en: 'Open help', es: 'Abrir ayuda' },
  headerCdl: { pt: 'Ajuda CDL', en: 'CDL Help', es: 'Ayuda CDL' },
  headerNamed: {
    pt: 'Ajuda {name}',
    en: '{name} Help',
    es: 'Ayuda {name}',
  },
  headerFallback: {
    pt: 'Catering Help',
    en: 'Catering Help',
    es: 'Catering Help',
  },
  greeting: {
    pt: 'Oi, tudo bem? Posso te ajudar nesta tela?',
    en: 'Hi — can I help you on this screen?',
    es: 'Hola, ¿puedo ayudarte en esta pantalla?',
  },
  hintGreeting: {
    pt: 'Oi, tudo bem? Posso te ajudar?',
    en: 'Hi — can I help you?',
    es: 'Hola, ¿puedo ayudarte?',
  },
  actionExplain: {
    pt: 'Explicar esta tela',
    en: 'Explain this screen',
    es: 'Explicar esta pantalla',
  },
  actionPending: {
    pt: 'Verificar pendências',
    en: 'Check pending items',
    es: 'Verificar pendientes',
  },
  actionNext: {
    pt: 'Próxima ação sugerida',
    en: 'Suggested next action',
    es: 'Próxima acción sugerida',
  },
  actionTips: {
    pt: 'Dicas rápidas',
    en: 'Quick tips',
    es: 'Consejos rápidos',
  },
  actionSupport: {
    pt: 'Falar com suporte',
    en: 'Talk to support',
    es: 'Hablar con soporte',
  },
  actionWhatsapp: {
    pt: 'Enviar por WhatsApp',
    en: 'Send via WhatsApp',
    es: 'Enviar por WhatsApp',
  },
  titleDefault: { pt: 'Ajuda', en: 'Help', es: 'Ayuda' },
  descDefault: {
    pt: 'Posso ajudar você a navegar e utilizar o sistema.',
    en: 'I can help you navigate and use the system.',
    es: 'Puedo ayudarte a navegar y usar el sistema.',
  },
  tipDefault1: {
    pt: 'Use o menu superior para alternar entre módulos.',
    en: 'Use the top menu to switch between modules.',
    es: 'Use el menú superior para cambiar entre módulos.',
  },
  tipDefault2: {
    pt: 'Em dúvida, revise os dados antes de salvar.',
    en: 'When in doubt, review the data before saving.',
    es: 'En duda, revise los datos antes de guardar.',
  },
  titleQuoteNew: {
    pt: 'Ajuda na cotação',
    en: 'Quote help',
    es: 'Ayuda en el presupuesto',
  },
  titleQuoteEdit: {
    pt: 'Ajuda na edição da cotação',
    en: 'Quote edit help',
    es: 'Ayuda en la edición del presupuesto',
  },
  titlePackages: {
    pt: 'Ajuda nos pacotes',
    en: 'Package help',
    es: 'Ayuda en los paquetes',
  },
  titleItems: {
    pt: 'Ajuda no cadastro de itens',
    en: 'Item catalog help',
    es: 'Ayuda en el catálogo de ítems',
  },
  titleCustomers: {
    pt: 'Ajuda no cadastro de clientes',
    en: 'Customer help',
    es: 'Ayuda en el registro de clientes',
  },
  titleCommercial: {
    pt: 'Ajuda nas regras comerciais',
    en: 'Business rules help',
    es: 'Ayuda en las reglas comerciales',
  },
  titleQuotes: {
    pt: 'Ajuda nas cotações',
    en: 'Quotes help',
    es: 'Ayuda en los presupuestos',
  },
  titleProposal: {
    pt: 'Ajuda da proposta',
    en: 'Proposal help',
    es: 'Ayuda de la propuesta',
  },
  titleHome: {
    pt: 'Ajuda do sistema',
    en: 'System help',
    es: 'Ayuda del sistema',
  },
  chipReviewQuote: {
    pt: 'Revisar cotação',
    en: 'Review quote',
    es: 'Revisar presupuesto',
  },
  chipMissing: { pt: 'Falta algo?', en: 'Anything missing?', es: '¿Falta algo?' },
  chipWhatsapp: { pt: 'WhatsApp', en: 'WhatsApp', es: 'WhatsApp' },
  chipNewQuote: {
    pt: 'Nova cotação',
    en: 'New quote',
    es: 'Nuevo presupuesto',
  },
  chipPending: {
    pt: 'Ver pendências',
    en: 'View pending',
    es: 'Ver pendientes',
  },
  chipReviewPackage: {
    pt: 'Revisar pacote',
    en: 'Review package',
    es: 'Revisar paquete',
  },
  chipItems: { pt: 'Ver itens', en: 'View items', es: 'Ver ítems' },
  chipSides: { pt: 'Ver guarnições', en: 'View sides', es: 'Ver guarniciones' },
  chipNoPrice: {
    pt: 'Itens sem preço',
    en: 'Items without price',
    es: 'Ítems sin precio',
  },
  chipNoCategory: {
    pt: 'Sem categoria',
    en: 'No category',
    es: 'Sin categoría',
  },
  chipUsage: { pt: 'Ver uso', en: 'View usage', es: 'Ver uso' },
  chipPhone: {
    pt: 'Validar telefone',
    en: 'Validate phone',
    es: 'Validar teléfono',
  },
  chipAddress: { pt: 'Endereço', en: 'Address', es: 'Dirección' },
  chipHowTo: { pt: 'Como usar', en: 'How to use', es: 'Cómo usar' },
})

export const tHelp = t
export const listHelpI18nEntries = list

const ACTION_KEYS = {
  explain: 'actionExplain',
  pending: 'actionPending',
  next: 'actionNext',
  tips: 'actionTips',
  support: 'actionSupport',
  whatsapp: 'actionWhatsapp',
} as const

export function helpActionLabel(
  locale: AuthLocale | string | null | undefined,
  action: keyof typeof ACTION_KEYS,
): string {
  return t(locale, ACTION_KEYS[action])
}

export function helpHeaderTitle(
  locale: AuthLocale | string | null | undefined,
  displayName: string,
): string {
  if (/cdl/i.test(displayName)) return t(locale, 'headerCdl')
  const short = displayName.split(/\s+/)[0]?.trim()
  return short
    ? t(locale, 'headerNamed', { name: short })
    : t(locale, 'headerFallback')
}
