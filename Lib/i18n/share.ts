import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('share', 'ui', {
  hint: {
    pt: 'Precisa de ajuda? Chame no WhatsApp',
    en: 'Need help? Message us on WhatsApp',
    es: '¿Necesita ayuda? Escríbanos por WhatsApp',
  },
  talkOnWhatsApp: {
    pt: 'Falar no WhatsApp',
    en: 'Chat on WhatsApp',
    es: 'Hablar por WhatsApp',
  },
  msgQuoteNew: {
    pt: 'Olá! Estou montando uma cotação da CDL BBQ e preciso de ajuda.',
    en: 'Hi! I am building a CDL BBQ quote and need help.',
    es: '¡Hola! Estoy armando un presupuesto de CDL BBQ y necesito ayuda.',
  },
  msgQuotes: {
    pt: 'Olá! Preciso de ajuda com minhas cotações da CDL BBQ.',
    en: 'Hi! I need help with my CDL BBQ quotes.',
    es: '¡Hola! Necesito ayuda con mis presupuestos de CDL BBQ.',
  },
  msgPackages: {
    pt: 'Olá! Preciso de ajuda com os pacotes da CDL BBQ.',
    en: 'Hi! I need help with CDL BBQ packages.',
    es: '¡Hola! Necesito ayuda con los paquetes de CDL BBQ.',
  },
  msgItems: {
    pt: 'Olá! Preciso de ajuda com o cadastro de itens da CDL BBQ.',
    en: 'Hi! I need help with the CDL BBQ item catalog.',
    es: '¡Hola! Necesito ayuda con el catálogo de ítems de CDL BBQ.',
  },
  msgCustomers: {
    pt: 'Olá! Preciso de ajuda com cliente ou endereço da CDL BBQ.',
    en: 'Hi! I need help with a CDL BBQ customer or address.',
    es: '¡Hola! Necesito ayuda con un cliente o dirección de CDL BBQ.',
  },
  msgProposal: {
    pt: 'Olá! Tenho uma dúvida sobre minha proposta da CDL BBQ.',
    en: 'Hi! I have a question about my CDL BBQ proposal.',
    es: '¡Hola! Tengo una duda sobre mi propuesta de CDL BBQ.',
  },
  msgDefault: {
    pt: 'Olá! Preciso de ajuda com a CDL BBQ.',
    en: 'Hi! I need help with CDL BBQ.',
    es: '¡Hola! Necesito ayuda con CDL BBQ.',
  },
  copyManual: {
    pt: 'Não foi possível copiar automaticamente — selecione o texto abaixo e copie.',
    en: 'Could not copy automatically — select the text below and copy it.',
    es: 'No fue posible copiar automáticamente — seleccione el texto abajo y cópielo.',
  },
  askedWindowsPaste: {
    pt: 'Pedimos ao Windows abrir o app. Se não aparecer, clique no WhatsApp na barra de tarefas e use Ctrl+V.',
    en: 'We asked Windows to open the app. If it does not appear, click WhatsApp on the taskbar and use Ctrl+V.',
    es: 'Pedimos a Windows abrir la app. Si no aparece, haga clic en WhatsApp en la barra de tareas y use Ctrl+V.',
  },
  askedWindowsTaskbar: {
    pt: 'Pedimos ao Windows abrir o app. Se não aparecer, use a barra de tarefas.',
    en: 'We asked Windows to open the app. If it does not appear, use the taskbar.',
    es: 'Pedimos a Windows abrir la app. Si no aparece, use la barra de tareas.',
  },
  copiedAgain: {
    pt: 'Mensagem copiada de novo.',
    en: 'Message copied again.',
    es: 'Mensaje copiado de nuevo.',
  },
  copyFailed: {
    pt: 'Falha ao copiar — selecione o texto manualmente.',
    en: 'Copy failed — select the text manually.',
    es: 'Error al copiar — seleccione el texto manualmente.',
  },
  sendTitle: {
    pt: 'Enviar no WhatsApp',
    en: 'Send on WhatsApp',
    es: 'Enviar por WhatsApp',
  },
  destination: { pt: 'Destino:', en: 'To:', es: 'Destino:' },
  windowsHint: {
    pt: 'No Windows o app da Store muitas vezes não vem para frente. O Web só funciona se este navegador já estiver logado (senão aparece QR). Use o caminho que funcionar aí.',
    en: 'On Windows the Store app often stays in the background. Web only works if this browser is already logged in (otherwise a QR code appears). Use whichever path works for you.',
    es: 'En Windows la app de la Store a menudo no pasa al frente. La Web solo funciona si este navegador ya está conectado (si no, aparece un QR). Use el camino que funcione.',
  },
  openDesktop: {
    pt: 'Abrir app Desktop',
    en: 'Open Desktop app',
    es: 'Abrir app de escritorio',
  },
  prepareSend: {
    pt: 'Preparar envio no WhatsApp',
    en: 'Prepare WhatsApp send',
    es: 'Preparar envío por WhatsApp',
  },
  unavailable: {
    pt: 'WhatsApp indisponível',
    en: 'WhatsApp unavailable',
    es: 'WhatsApp no disponible',
  },
  openWaMe: {
    pt: 'Abre o link padrão do WhatsApp (wa.me)',
    en: 'Opens the standard WhatsApp link (wa.me)',
    es: 'Abre el enlace estándar de WhatsApp (wa.me)',
  },
})

export const tShare = t
export const listShareI18nEntries = list

export function getWhatsappShareMessage(
  locale: string | null | undefined,
  pathname: string,
): string {
  if (pathname.includes('/quotes/new')) return t(locale, 'msgQuoteNew')
  if (pathname.includes('/quotes')) return t(locale, 'msgQuotes')
  if (pathname.includes('/packages')) return t(locale, 'msgPackages')
  if (pathname.includes('/additional-items')) return t(locale, 'msgItems')
  if (pathname.includes('/customers')) return t(locale, 'msgCustomers')
  if (pathname.includes('/customer-quote')) return t(locale, 'msgProposal')
  return t(locale, 'msgDefault')
}
