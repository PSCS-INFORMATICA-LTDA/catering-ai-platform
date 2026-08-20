import { helpHeaderTitle, tHelp } from '@/Lib/i18n/help'

export type HelpChatChip = {
  id: string
  label: string
  response: string
}

export function getHelpGreeting(locale?: string | null): string {
  return tHelp(locale, 'greeting')
}

export function getHelpHintGreeting(locale?: string | null): string {
  return tHelp(locale, 'hintGreeting')
}

export function getContextChatMessage(pathname: string): string {
  const path = pathname.split('?')[0] ?? '/'

  if (path === '/quotes/new') {
    return 'Você está criando uma cotação. Posso te ajudar a revisar cliente, pacote, adicionais e envio.'
  }
  if (/^\/quotes\/[^/]+\/edit$/.test(path)) {
    return 'Você está editando uma cotação. Posso ajudar a revisar alterações antes de salvar.'
  }
  if (path === '/quotes' || /^\/quotes\/[^/]+$/.test(path)) {
    return 'Você está na tela de cotações. Posso te ajudar a criar uma nova cotação ou revisar propostas abertas.'
  }
  if (path.startsWith('/packages')) {
    return 'Você está nos pacotes. Posso ajudar a revisar itens, guarnições e escolhas obrigatórias.'
  }
  if (path.startsWith('/additional-items') || path.startsWith('/items')) {
    return 'Você está no cadastro de itens. Posso ajudar a revisar preço, categoria e uso do item.'
  }
  if (path.startsWith('/customers')) {
    return 'Você está nos clientes. Posso ajudar com telefone, endereço e validação.'
  }
  if (path.startsWith('/commercial-rules')) {
    return 'Você está nas regras comerciais. Posso ajudar com mínimos, taxas e descontos.'
  }
  return 'Posso ajudar você a usar esta tela com mais rapidez.'
}

export function getChatChipsForRoute(
  pathname: string,
  locale?: string | null,
): HelpChatChip[] {
  const path = pathname.split('?')[0] ?? '/'

  if (path === '/quotes/new' || /^\/quotes\/[^/]+\/edit$/.test(path)) {
    return [
      {
        id: 'review-quote',
        label: tHelp(locale, 'chipReviewQuote'),
        response:
          'Confira cliente, data, pacote com escolhas, adicionais e endereço antes de avançar.',
      },
      {
        id: 'missing',
        label: tHelp(locale, 'chipMissing'),
        response:
          'Vou verificar o básico: cliente, pacote, endereço e preço. Em breve isso será automático.',
      },
      {
        id: 'whatsapp',
        label: tHelp(locale, 'chipWhatsapp'),
        response:
          'Em breve vou preparar a mensagem do WhatsApp com resumo e link da cotação.',
      },
    ]
  }

  if (path === '/quotes' || /^\/quotes\/[^/]+$/.test(path)) {
    return [
      {
        id: 'new-quote',
        label: tHelp(locale, 'chipNewQuote'),
        response:
          'Para criar uma cotação, toque em Nova Cotação e siga: cliente, evento, pacote, adicionais e revisão.',
      },
      {
        id: 'pending',
        label: tHelp(locale, 'chipPending'),
        response:
          'Vou verificar o básico: cliente, pacote, endereço, preço e status. Em breve isso será automático.',
      },
      {
        id: 'whatsapp',
        label: tHelp(locale, 'chipWhatsapp'),
        response:
          'Em breve vou preparar a mensagem do WhatsApp com resumo e link da cotação.',
      },
    ]
  }

  if (path.startsWith('/packages')) {
    return [
      {
        id: 'review-package',
        label: tHelp(locale, 'chipReviewPackage'),
        response:
          'Confira itens fixos, guarnições (+) e escolhas obrigatórias no cadastro do pacote.',
      },
      {
        id: 'items',
        label: tHelp(locale, 'chipItems'),
        response: 'Itens fixos ficam em package_items — separados de guarnições e escolhas.',
      },
      {
        id: 'sides',
        label: tHelp(locale, 'chipSides'),
        response:
          'Guarnições são configuradas dentro de cada pacote com +, em Pacotes.',
      },
    ]
  }

  if (path.startsWith('/additional-items') || path.startsWith('/items')) {
    return [
      {
        id: 'no-price',
        label: tHelp(locale, 'chipNoPrice'),
        response: 'Itens sem preço não entram corretamente na cotação. Revise o cadastro.',
      },
      {
        id: 'no-category',
        label: tHelp(locale, 'chipNoCategory'),
        response: 'Categoria ajuda a organizar adicionais na etapa de seleção.',
      },
      {
        id: 'usage',
        label: tHelp(locale, 'chipUsage'),
        response: 'Em breve mostrarei em quais pacotes e cotações o item aparece.',
      },
    ]
  }

  if (path.startsWith('/customers')) {
    return [
      {
        id: 'phone',
        label: tHelp(locale, 'chipPhone'),
        response: 'Telefone válido facilita contato e confirmação do evento.',
      },
      {
        id: 'address',
        label: tHelp(locale, 'chipAddress'),
        response: 'Endereço completo ajuda na etapa de logística da cotação.',
      },
      {
        id: 'whatsapp',
        label: tHelp(locale, 'chipWhatsapp'),
        response: 'Em breve vou preparar mensagem para o cliente por WhatsApp.',
      },
    ]
  }

  return [
    {
      id: 'help',
      label: tHelp(locale, 'chipHowTo'),
      response: 'Use o menu superior para navegar entre módulos do Catering.',
    },
    {
      id: 'pending',
      label: tHelp(locale, 'chipPending'),
      response: 'Revise os campos principais desta tela antes de salvar.',
    },
  ]
}

export function resolveHelpHeaderTitle(
  displayName: string,
  locale?: string | null,
): string {
  return helpHeaderTitle(locale, displayName)
}
