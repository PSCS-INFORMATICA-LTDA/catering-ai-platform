/** Regras comerciais CDL — CDLBBQBR 26 */

export const MILEAGE_BASE_LOCATION = 'Orlando Eye'
export const LEGACY_MILEAGE_BASE_PATTERN = /downtown\s*orlando/i

export function getMileageBaseLocation(stored?: string | null): string {
  const value = stored?.trim()
  if (!value || LEGACY_MILEAGE_BASE_PATTERN.test(value)) {
    return MILEAGE_BASE_LOCATION
  }
  return value
}

export const MILEAGE_FREE_LIMIT = 20
export const MILEAGE_RATE = 2
export const MILEAGE_UNIT = 'mi'

export const RESERVATION_PERCENTAGE = 30
export const BALANCE_PERCENTAGE = 70

export const LATE_PAYMENT_FEE_PER_DAY = 100

export const FOOD_STORAGE_FINE = 300

export const MIN_ORDER_WEEKDAY = 800
export const MIN_ORDER_WEEKEND = 1000
export const MIN_ORDER_DEC_JAN = 900
export const HOLIDAY_SURCHARGE_PERCENT = 100
export const HOLIDAY_MIN_ORDER = 2000

/** Datas clássicas CDL (subset). Acréscimo 100% cobre todos os feriados federais EUA — ver Lib/usHolidays.ts. */
export { HOLIDAY_DATES, CDL_EXTRA_SURCHARGE_DATES } from './usHolidays'

export const CHILD_FREE_AGE_MAX = 3
export const CHILD_HALF_AGE_MAX = 12

export const SERVICE_DURATION_HOURS = 4
/** Informational only: crew arrives before service start. Not a billed hour. */
export const CREW_SETUP_LEAD_MINUTES = 60
/**
 * Future commercial rule only. MUST stay inactive.
 * Do not apply to pricing, invoice, extras, or public quote totals.
 */
export const EXTRA_SERVICE_HOUR_PERCENTAGE = 25
export const WAITER_SERVICE_FEE = 250
export const GRILL_RENTAL_FEE = 100

export const SIDES_PRICE_PER_PERSON = 13

export const PACKAGE_COMMON_ITEMS = [
  'Chimichurri',
  'Farofa',
  'Mel',
  'Goiabada',
  'Pimenta de bico',
  'Geleia de pimenta',
] as const

export const SIDES_ITEMS = [
  'Arroz branco',
  'Feijão preto',
  'Vinagrete',
  'Farofa',
  'Maionese',
] as const

export type CdlPackageDefinition = {
  package_key: string
  label_pt: string
  label_en: string
  label_es: string
  price_per_person: number
  items: readonly string[]
  with_sides: boolean
  display_order: number
}

function buildDescription(
  items: readonly string[],
  withSides: boolean,
): string {
  const lines = [
    'Itens do pacote:',
    ...items.map((item) => `• ${item}`),
    '',
    'Todos os pacotes acompanham:',
    ...PACKAGE_COMMON_ITEMS.map((item) => `• ${item}`),
  ]
  if (withSides) {
    lines.push('', 'Guarnições inclusas (+$13/pessoa):', ...SIDES_ITEMS.map((item) => `• ${item}`))
  }
  return lines.join('\n')
}

export const CDL_PACKAGES: CdlPackageDefinition[] = [
  {
    package_key: 'BBQTRAD',
    label_pt: 'BBQ Tradicional',
    label_en: 'BBQ Traditional',
    label_es: 'BBQ Tradicional',
    price_per_person: 45,
    items: [
      'Picanha Angus',
      'Linguiça tradicional',
      'Frango sobrecoxa desossada',
      'Pão de alho',
      'Queijo coalho',
      'Milho',
    ],
    with_sides: false,
    display_order: 1,
  },
  {
    package_key: 'BBQSEL',
    label_pt: 'BBQ Select',
    label_en: 'BBQ Select',
    label_es: 'BBQ Select',
    price_per_person: 55,
    items: [
      'Picanha Angus',
      'Costela de porco ou boi',
      'Linguiça tradicional',
      'Frango sobrecoxa desossada',
      'Pão de alho',
      'Queijo',
      'Milho',
    ],
    with_sides: false,
    display_order: 2,
  },
  {
    package_key: 'BBQCHO',
    label_pt: 'BBQ Choice',
    label_en: 'BBQ Choice',
    label_es: 'BBQ Choice',
    price_per_person: 65,
    items: [
      'Picanha Angus',
      'Salmão ou camarão',
      'Costela de porco ou boi',
      'Linguiça',
      'Frango sobrecoxa desossada',
      'Pão de alho',
      'Queijo',
      'Milho',
    ],
    with_sides: false,
    display_order: 3,
  },
  {
    package_key: 'BBQPRI',
    label_pt: 'BBQ Prime',
    label_en: 'BBQ Prime',
    label_es: 'BBQ Prime',
    price_per_person: 75,
    items: [
      'Picanha Angus',
      'Salmão ou camarão',
      'Costela de porco ou boi',
      'Carré de cordeiro',
      'Linguiça',
      'Frango sobrecoxa desossada',
      'Pão de alho',
      'Queijo',
      'Milho',
    ],
    with_sides: false,
    display_order: 4,
  },
  {
    package_key: 'BBQLUX',
    label_pt: 'BBQ Luxury',
    label_en: 'BBQ Luxury',
    label_es: 'BBQ Luxury',
    price_per_person: 150,
    items: [
      'Picanha Angus',
      'Picanha Wagyu',
      'Lagosta ou Vieira com bacon',
      'Salmão ou camarão',
      'Costela de porco ou boi',
      'Fraldinha Angus',
      'Carré de cordeiro',
      'Linguiça',
      'Frango sobrecoxa desossada',
      'Pão de alho',
      'Queijo',
      'Milho',
    ],
    with_sides: false,
    display_order: 9,
  },
  {
    package_key: 'BBQTRAD+',
    label_pt: 'BBQ Tradicional com guarnições',
    label_en: 'BBQ Traditional with side dishes',
    label_es: 'BBQ Tradicional con guarniciones',
    price_per_person: 58,
    items: [
      'Picanha Angus',
      'Linguiça tradicional',
      'Frango sobrecoxa desossada',
      'Pão de alho',
      'Queijo coalho',
      'Milho',
    ],
    with_sides: true,
    display_order: 5,
  },
  {
    package_key: 'BBQSEL+',
    label_pt: 'BBQ Select com guarnições',
    label_en: 'BBQ Select with side dishes',
    label_es: 'BBQ Select con guarniciones',
    price_per_person: 68,
    items: [
      'Picanha Angus',
      'Costela de porco ou boi',
      'Linguiça tradicional',
      'Frango sobrecoxa desossada',
      'Pão de alho',
      'Queijo',
      'Milho',
    ],
    with_sides: true,
    display_order: 6,
  },
  {
    package_key: 'BBQCHO+',
    label_pt: 'BBQ Choice com guarnições',
    label_en: 'BBQ Choice with side dishes',
    label_es: 'BBQ Choice con guarniciones',
    price_per_person: 78,
    items: [
      'Picanha Angus',
      'Salmão ou camarão',
      'Costela de porco ou boi',
      'Linguiça',
      'Frango sobrecoxa desossada',
      'Pão de alho',
      'Queijo',
      'Milho',
    ],
    with_sides: true,
    display_order: 7,
  },
  {
    package_key: 'BBQPRI+',
    label_pt: 'BBQ Prime com guarnições',
    label_en: 'BBQ Prime with side dishes',
    label_es: 'BBQ Prime con guarniciones',
    price_per_person: 88,
    items: [
      'Picanha Angus',
      'Salmão ou camarão',
      'Costela de porco ou boi',
      'Carré de cordeiro',
      'Linguiça',
      'Frango sobrecoxa desossada',
      'Pão de alho',
      'Queijo',
      'Milho',
    ],
    with_sides: true,
    display_order: 8,
  },
  {
    package_key: 'BBQLUX+',
    label_pt: 'BBQ Luxury com guarnições',
    label_en: 'BBQ Luxury with side dishes',
    label_es: 'BBQ Luxury con guarniciones',
    price_per_person: 163,
    items: [
      'Picanha Angus',
      'Picanha Wagyu',
      'Lagosta ou Vieira com bacon',
      'Salmão ou camarão',
      'Costela de porco ou boi',
      'Fraldinha Angus',
      'Carré de cordeiro',
      'Linguiça',
      'Frango sobrecoxa desossada',
      'Pão de alho',
      'Queijo',
      'Milho',
    ],
    with_sides: true,
    display_order: 10,
  },
]

export function getPackageDescriptionPt(pkg: CdlPackageDefinition): string {
  return buildDescription(pkg.items, pkg.with_sides)
}

export const RESERVATION_PAYMENT_TEXT =
  'Para reservar a data, é necessário pagamento antecipado de 30%. O saldo restante deve ser pago até o término do evento.'

export const CANCELLATION_POLICY_SUMMARY = [
  'Até 72 horas antes: reagendamento em até 3 meses; o adiantamento pago pode ser considerado no próximo evento.',
  'Até 48 horas antes: desconta-se 50% do adiantamento pago; reagendamento em até 3 meses com 50% de crédito.',
  'Com menos de 48 horas: o adiantamento é perdido, sem reembolso e sem reagendamento.',
  'Reagendamento sujeito à disponibilidade, com limite de 1 reagendamento. Não há reembolso.',
  'O crédito pode ser transferido para terceiros, respeitando esta política.',
  'Em caso de clima, o reagendamento pode ser solicitado até 72 horas antes.',
  'Solicitação por WhatsApp ou mensagem de texto para +1 (407) 915-2242, sujeita a aprovação.',
] as const

export const IMPORTANT_RULES = {
  minimumOrder: [
    `Segunda a quinta-feira: pedido mínimo de $${MIN_ORDER_WEEKDAY}.`,
    `Sexta a domingo: pedido mínimo de $${MIN_ORDER_WEEKEND}.`,
  ],
  mileage: [
    `Base de cálculo: ${MILEAGE_BASE_LOCATION}.`,
    `Até ${MILEAGE_FREE_LIMIT} ${MILEAGE_UNIT}: sem taxa de deslocamento.`,
    `Acima de ${MILEAGE_FREE_LIMIT} ${MILEAGE_UNIT}: $${MILEAGE_RATE} por ${MILEAGE_UNIT} sobre o trajeto total. Exemplo: 30 ${MILEAGE_UNIT} = $60.`,
  ],
  reservation: [
    `${RESERVATION_PERCENTAGE}% antecipado para reservar a data.`,
    `${BALANCE_PERCENTAGE}% restante até o término do evento.`,
  ],
  foodPolicy: [
    'Não é permitido armazenar comida para consumir após o serviço.',
    `Multa por descumprimento: $${FOOD_STORAGE_FINE}.`,
  ],
  latePayment: [
    `Multa por atraso no pagamento: $${LATE_PAYMENT_FEE_PER_DAY} por dia.`,
  ],
  /** Adicional de datas comemorativas / feriados EUA. */
  decemberJanuary: [
    `Dezembro e janeiro (exceto 24, 25 e 31 de dezembro e 1º de janeiro): pedido mínimo de $${MIN_ORDER_DEC_JAN}.`,
    `Em 24, 25 e 31 de dezembro e 1º de janeiro: acréscimo de ${HOLIDAY_SURCHARGE_PERCENT}% somente no pacote e pedido mínimo de $${HOLIDAY_MIN_ORDER}. Sem reembolso ou reagendamento.`,
    'Demais feriados federais dos EUA fora de dezembro/janeiro mantêm o adicional comercial vigente.',
  ],
} as const

export const CUSTOMER_QUOTE_SECTIONS = [
  {
    title: 'Como funciona o serviço',
    body: [
      `Serviço de churrasco no formato buffet / all you can eat, por até ${SERVICE_DURATION_HOURS} horas.`,
      'Não trabalhamos com bebidas.',
      `Serviço de garçom opcional: $${WAITER_SERVICE_FEE}.`,
      `Churrasqueira não inclusa — aluguel $${GRILL_RENTAL_FEE}.`,
      `Crianças até ${CHILD_FREE_AGE_MAX} anos não pagam; até ${CHILD_HALF_AGE_MAX} anos pagam meia.`,
    ],
  },
  {
    title: 'Escolha o pacote',
    body: CDL_PACKAGES.filter((p) => !p.with_sides).map(
      (p) => `${p.label_pt}: $${p.price_per_person}/pessoa`,
    ),
  },
  {
    title: 'Escolha com ou sem guarnições',
    body: [
      `Guarnições adicionais: +$${SIDES_PRICE_PER_PERSON}/pessoa.`,
      ...SIDES_ITEMS.map((item) => `• ${item}`),
    ],
  },
  {
    title: 'Adicione itens extras',
    body: [
      'Personalize seu evento com cortes premium, acompanhamentos e equipamentos.',
      'Os valores dos adicionais são calculados na cotação.',
    ],
  },
  {
    title: 'Informe os dados do evento',
    body: [
      'Data, horário, local, endereço e número de convidados (adultos e crianças).',
    ],
  },
  {
    title: 'Informe churrasqueira e estrutura',
    body: [
      'Informe se há churrasqueira no local, se foto é necessária e se aluguel é requerido.',
      `Aluguel de churrasqueira: $${GRILL_RENTAL_FEE}.`,
    ],
  },
  {
    title: 'Milhagem e deslocamento',
    body: IMPORTANT_RULES.mileage,
  },
  {
    title: 'Reserva de 30%',
    body: [RESERVATION_PAYMENT_TEXT, ...IMPORTANT_RULES.reservation],
  },
  {
    title: 'Regras importantes',
    body: [
      ...IMPORTANT_RULES.minimumOrder,
      ...IMPORTANT_RULES.foodPolicy,
      ...IMPORTANT_RULES.latePayment,
    ],
  },
  {
    title: 'Adicional de datas comemorativas',
    body: [...IMPORTANT_RULES.decemberJanuary],
  },
  {
    title: 'Política de cancelamento',
    body: [...CANCELLATION_POLICY_SUMMARY],
  },
  {
    title: 'Iniciar cotação',
    body: [
      'Revise as informações acima e inicie sua cotação personalizada.',
    ],
  },
] as const
