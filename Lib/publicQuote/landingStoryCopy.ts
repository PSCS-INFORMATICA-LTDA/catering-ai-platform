import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export type LandingHighlightTone = 'red' | 'yellow'

export type LandingTitlePart = {
  text: string
  highlight?: LandingHighlightTone
  breakAfter?: boolean
}

export type LandingStoryChapter = {
  id: string
  kicker: string
  title: readonly LandingTitlePart[]
  badge?: { text: string; tone: LandingHighlightTone }
  body: string
}

export type LandingStoryCopy = {
  hero: {
    eyebrow: string
    title: readonly LandingTitlePart[]
    subtitle: string
    microcopy: string
    quickCta: string
  }
  howItWorksTitle: readonly LandingTitlePart[]
  stories: readonly LandingStoryChapter[]
  finalCta: {
    eyebrow: string
    title: readonly LandingTitlePart[]
    body: string
    button: string
  }
  video: {
    eyebrow: string
    body: string
    play: string
    title: string
    close: string
    locales: { pt: string; en: string; es: string }
  }
}

export const PUBLIC_LANDING_STORY = {
  pt: {
    hero: {
      eyebrow: 'ORÇAMENTO ONLINE',
      title: [
        { text: 'O melhor do', breakAfter: true },
        { text: 'churrasco', highlight: 'red', breakAfter: true },
        { text: 'brasileiro', highlight: 'red' },
        { text: ',', breakAfter: true },
        { text: 'onde você estiver.' },
      ],
      subtitle:
        'Uma experiência completa de Brazilian BBQ no seu evento — estrutura, chef churrasqueiro e preparo ao vivo.',
      microcopy:
        'Monte seu evento em poucos minutos. Nossa equipe revisa tudo antes da confirmação.',
      quickCta: 'COMEÇAR COTAÇÃO',
    },
    howItWorksTitle: [
      { text: 'ENTENDA', breakAfter: true },
      { text: 'COMO', breakAfter: true },
      { text: 'FUNCIONA', highlight: 'yellow' },
    ],
    stories: [
      {
        id: 'more-than-catering',
        kicker: '01 — NOSSA EXPERIÊNCIA',
        title: [
          { text: 'Muito mais que', highlight: 'red', breakAfter: true },
          { text: 'CATERING.', highlight: 'red' },
        ],
        body: 'Levamos nossa estrutura completa até o local do seu evento, para que você aproveite a experiência enquanto cuidamos da operação.',
      },
      {
        id: 'full-setup',
        kicker: '02 — LEVAMOS ATÉ VOCÊ',
        title: [
          { text: 'A estrutura vai.', breakAfter: true },
          { text: 'Você só aproveita.' },
        ],
        badge: { text: 'ESTRUTURA COMPLETA', tone: 'red' },
        body: 'Levamos até o local todo o necessário para criar uma verdadeira experiência de churrasco brasileiro, com organização, cuidado e presença.',
      },
      {
        id: 'live-bbq',
        kicker: '03 — PREPARADO NA HORA',
        title: [
          { text: 'Churrasco preparado', breakAfter: true },
          { text: 'AO VIVO.', highlight: 'red' },
        ],
        body: 'O chef churrasqueiro fica disponível durante o serviço, preparando o churrasco em tempo real para você e seus convidados.',
      },
      {
        id: 'buffet',
        kicker: '04 — LIBERDADE PARA APROVEITAR',
        title: [
          { text: 'Seu evento.', breakAfter: true },
          { text: 'Seu ritmo.' },
        ],
        badge: { text: 'BUFFET', tone: 'yellow' },
        body: 'Nosso serviço é no formato buffet, trazendo liberdade e praticidade para que cada convidado se sirva de acordo com seu gosto.',
      },
      {
        id: 'since-2017',
        kicker: '05 — EXPERIÊNCIA CDL',
        title: [
          { text: 'Aperfeiçoando essa experiência', breakAfter: true },
          { text: 'DESDE 2017.', highlight: 'red' },
        ],
        body: 'Qualidade, higiene, organização e técnicas aperfeiçoadas ao longo dos anos para transformar um churrasco em uma experiência que seus convidados lembram.',
      },
    ],
    finalCta: {
      eyebrow: 'PRONTO PARA O SEU EVENTO?',
      title: [
        { text: 'Agora monte o seu', breakAfter: true },
        { text: 'churrasco.', highlight: 'red' },
      ],
      body: 'Escolha os detalhes do seu evento e receba uma estimativa online.',
      button: 'COMEÇAR MINHA COTAÇÃO',
    },
    video: {
      eyebrow: 'QUER VER COMO FUNCIONA?',
      body: 'Confira a experiência CDL em ação.',
      play: 'CONFIRA COMO FUNCIONA',
      title: 'Como funciona',
      close: 'Fechar',
      locales: { pt: 'Português', en: 'English', es: 'Español' },
    },
  },
  en: {
    hero: {
      eyebrow: 'ONLINE QUOTE',
      title: [
        { text: 'The best of', breakAfter: true },
        { text: 'Brazilian', highlight: 'red', breakAfter: true },
        { text: 'barbecue', highlight: 'red' },
        { text: ',', breakAfter: true },
        { text: 'wherever you are.' },
      ],
      subtitle:
        'A complete Brazilian BBQ experience at your event — full setup, grill chef and live preparation.',
      microcopy:
        'Build your event in just a few minutes. Our team reviews everything before confirmation.',
      quickCta: 'START QUOTE',
    },
    howItWorksTitle: [
      { text: 'SEE', breakAfter: true },
      { text: 'HOW IT', breakAfter: true },
      { text: 'WORKS', highlight: 'yellow' },
    ],
    stories: [
      {
        id: 'more-than-catering',
        kicker: '01 — OUR EXPERIENCE',
        title: [
          { text: 'Much more than', highlight: 'red', breakAfter: true },
          { text: 'CATERING.', highlight: 'red' },
        ],
        body: 'We bring our complete setup to your event, so you can enjoy the experience while we take care of the operation.',
      },
      {
        id: 'full-setup',
        kicker: '02 — WE COME TO YOU',
        title: [
          { text: 'The setup comes to you.', breakAfter: true },
          { text: 'You simply enjoy it.' },
        ],
        badge: { text: 'COMPLETE SETUP', tone: 'red' },
        body: 'We bring what is needed to create an authentic Brazilian BBQ experience, with organization, care and professional service.',
      },
      {
        id: 'live-bbq',
        kicker: '03 — PREPARED LIVE',
        title: [
          { text: 'Brazilian BBQ,', breakAfter: true },
          { text: 'PREPARED LIVE.', highlight: 'red' },
        ],
        body: 'Your grill chef remains available throughout the service, preparing the barbecue in real time for you and your guests.',
      },
      {
        id: 'buffet',
        kicker: '04 — FREEDOM TO ENJOY',
        title: [
          { text: 'Your event.', breakAfter: true },
          { text: 'Your pace.' },
        ],
        badge: { text: 'BUFFET', tone: 'yellow' },
        body: 'Our service is buffet-style, giving every guest the freedom and convenience to serve themselves according to their taste.',
      },
      {
        id: 'since-2017',
        kicker: '05 — THE CDL EXPERIENCE',
        title: [
          { text: 'Perfecting the experience', breakAfter: true },
          { text: 'SINCE 2017.', highlight: 'red' },
        ],
        body: 'Quality, hygiene, organization and techniques refined over the years to turn barbecue into an experience your guests remember.',
      },
    ],
    finalCta: {
      eyebrow: 'READY FOR YOUR EVENT?',
      title: [
        { text: 'Now build your', breakAfter: true },
        { text: 'Brazilian BBQ.', highlight: 'red' },
      ],
      body: 'Choose the details of your event and get your online estimate.',
      button: 'START MY QUOTE',
    },
    video: {
      eyebrow: 'WANT TO SEE HOW IT WORKS?',
      body: 'See the CDL experience in action.',
      play: 'SEE HOW IT WORKS',
      title: 'How it works',
      close: 'Close',
      locales: { pt: 'Português', en: 'English', es: 'Español' },
    },
  },
  es: {
    hero: {
      eyebrow: 'COTIZACIÓN ONLINE',
      title: [
        { text: 'Lo mejor de la', breakAfter: true },
        { text: 'parrilla', highlight: 'red', breakAfter: true },
        { text: 'brasileña', highlight: 'red' },
        { text: ',', breakAfter: true },
        { text: 'donde tú estés.' },
      ],
      subtitle:
        'Una experiencia completa de Brazilian BBQ en tu evento — estructura, chef parrillero y preparación en vivo.',
      microcopy:
        'Arma tu evento en pocos minutos. Nuestro equipo revisa todo antes de la confirmación.',
      quickCta: 'COMENZAR COTIZACIÓN',
    },
    howItWorksTitle: [
      { text: 'CONOCE', breakAfter: true },
      { text: 'CÓMO', breakAfter: true },
      { text: 'FUNCIONA', highlight: 'yellow' },
    ],
    stories: [
      {
        id: 'more-than-catering',
        kicker: '01 — NUESTRA EXPERIENCIA',
        title: [
          { text: 'Mucho más que', highlight: 'red', breakAfter: true },
          { text: 'CATERING.', highlight: 'red' },
        ],
        body: 'Llevamos nuestra estructura completa hasta el lugar de tu evento, para que disfrutes la experiencia mientras nosotros cuidamos la operación.',
      },
      {
        id: 'full-setup',
        kicker: '02 — VAMOS HASTA TI',
        title: [
          { text: 'La estructura llega.', breakAfter: true },
          { text: 'Tú solo disfrutas.' },
        ],
        badge: { text: 'ESTRUCTURA COMPLETA', tone: 'red' },
        body: 'Llevamos lo necesario para crear una auténtica experiencia de parrilla brasileña, con organización, cuidado y atención profesional.',
      },
      {
        id: 'live-bbq',
        kicker: '03 — PREPARADO EN VIVO',
        title: [
          { text: 'Parrilla brasileña,', breakAfter: true },
          { text: 'PREPARADA EN VIVO.', highlight: 'red' },
        ],
        body: 'El chef parrillero permanece disponible durante el servicio, preparando la parrilla en tiempo real para ti y tus invitados.',
      },
      {
        id: 'buffet',
        kicker: '04 — LIBERTAD PARA DISFRUTAR',
        title: [
          { text: 'Tu evento.', breakAfter: true },
          { text: 'A tu ritmo.' },
        ],
        badge: { text: 'BUFFET', tone: 'yellow' },
        body: 'Nuestro servicio es estilo buffet, ofreciendo libertad y practicidad para que cada invitado se sirva según su gusto.',
      },
      {
        id: 'since-2017',
        kicker: '05 — LA EXPERIENCIA CDL',
        title: [
          { text: 'Perfeccionando la experiencia', breakAfter: true },
          { text: 'DESDE 2017.', highlight: 'red' },
        ],
        body: 'Calidad, higiene, organización y técnicas perfeccionadas con los años para transformar una parrillada en una experiencia que tus invitados recuerdan.',
      },
    ],
    finalCta: {
      eyebrow: '¿LISTO PARA TU EVENTO?',
      title: [
        { text: 'Ahora arma tu', breakAfter: true },
        { text: 'parrillada.', highlight: 'red' },
      ],
      body: 'Elige los detalles de tu evento y recibe tu estimación online.',
      button: 'COMENZAR MI COTIZACIÓN',
    },
    video: {
      eyebrow: '¿QUIERES VER CÓMO FUNCIONA?',
      body: 'Mira la experiencia CDL en acción.',
      play: 'MIRA CÓMO FUNCIONA',
      title: 'Cómo funciona',
      close: 'Cerrar',
      locales: { pt: 'Português', en: 'English', es: 'Español' },
    },
  },
} as const satisfies Record<QuoteLanguage, LandingStoryCopy>

export function publicLandingStory(locale: QuoteLanguage): LandingStoryCopy {
  return PUBLIC_LANDING_STORY[locale]
}

export function groupLandingTitleLines(
  parts: readonly LandingTitlePart[],
): LandingTitlePart[][] {
  const lines: LandingTitlePart[][] = []
  let current: LandingTitlePart[] = []
  for (const part of parts) {
    current.push(part)
    if (part.breakAfter) {
      lines.push(current)
      current = []
    }
  }
  if (current.length) lines.push(current)
  return lines
}

export const LANDING_FORBIDDEN_COMMERCE_TERMS = [
  'zelle',
  'cash',
  'bank transfer',
  'transferencia',
  'transferência',
  'cancelamento',
  'cancelation',
  'cancellation',
  'pagamento',
  'payment',
  'december',
  'dezembro',
  'janeiro',
] as const
