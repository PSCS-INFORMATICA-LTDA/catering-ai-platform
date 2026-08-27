import type { QuoteLanguage } from './quoteWizardTypes'

export const CDL_CANCEL_POLICY_VERSION = 'CDL_CANCEL_2026_V1'
export const CDL_CANCEL_CONTACT_PHONE = '+1 (407) 915-2242'

export type CancellationPolicySection = {
  id: string
  label: string
  items: readonly string[]
}

export type CancellationPolicyCopy = {
  title: string
  acceptLabel: string
  windows: readonly CancellationPolicySection[]
  extras: readonly CancellationPolicySection[]
}

const COPY: Record<QuoteLanguage, CancellationPolicyCopy> = {
  pt: {
    title: 'Política de Cancelamento',
    acceptLabel: 'Li e concordo com a Política de Cancelamento.',
    windows: [
      {
        id: '72h',
        label: 'Até 72h',
        items: [
          'Solicitação até 72 horas antes do evento.',
          'Reagendamento para até os próximos 3 meses.',
          'O valor total pago do adiantamento pode ser considerado para o próximo evento.',
        ],
      },
      {
        id: '48h',
        label: 'Até 48h',
        items: [
          'Solicitação até 48 horas antes do evento.',
          'Desconta-se 50% do valor já pago do adiantamento.',
          'Reagendamento para até os próximos 3 meses.',
          'Somente 50% do valor do adiantamento é considerado para o próximo evento.',
        ],
      },
      {
        id: 'lt48h',
        label: 'Menos de 48h',
        items: [
          'Solicitação com menos de 48 horas de antecedência.',
          'O valor total do adiantamento é perdido.',
          'Sem reembolso.',
          'Sem reagendamento.',
        ],
      },
    ],
    extras: [
      {
        id: 'rebook',
        label: 'Reagendamento',
        items: [
          'Reagendamento sujeito à disponibilidade.',
          'Limite de 1 reagendamento.',
          'Não há reembolso.',
        ],
      },
      {
        id: 'transfer',
        label: 'Transferência de crédito',
        items: [
          'O crédito pode ser transferido para terceiros, respeitando esta política.',
        ],
      },
      {
        id: 'weather',
        label: 'Clima',
        items: [
          'Em caso de clima, o reagendamento pode ser solicitado até 72 horas antes.',
        ],
      },
      {
        id: 'request',
        label: 'Como solicitar',
        items: [
          'A solicitação de cancelamento deve ser feita por WhatsApp ou mensagem de texto.',
          'A solicitação precisa ser aprovada.',
          `Contato: ${CDL_CANCEL_CONTACT_PHONE}`,
        ],
      },
    ],
  },
  en: {
    title: 'Cancellation Policy',
    acceptLabel: 'I have read and agree to the Cancellation Policy.',
    windows: [
      {
        id: '72h',
        label: 'Up to 72h',
        items: [
          'Request up to 72 hours before the event.',
          'Reschedule within the next 3 months.',
          'The full deposit already paid may be applied to the next event.',
        ],
      },
      {
        id: '48h',
        label: 'Up to 48h',
        items: [
          'Request up to 48 hours before the event.',
          '50% of the deposit already paid is deducted.',
          'Reschedule within the next 3 months.',
          'Only 50% of the deposit is applied to the next event.',
        ],
      },
      {
        id: 'lt48h',
        label: 'Less than 48h',
        items: [
          'Request less than 48 hours before the event.',
          'The full deposit is forfeited.',
          'No refund.',
          'No reschedule.',
        ],
      },
    ],
    extras: [
      {
        id: 'rebook',
        label: 'Reschedule',
        items: [
          'Rescheduling is subject to availability.',
          'Limit of 1 reschedule.',
          'There is no refund.',
        ],
      },
      {
        id: 'transfer',
        label: 'Credit transfer',
        items: [
          'Credit may be transferred to a third party, subject to this policy.',
        ],
      },
      {
        id: 'weather',
        label: 'Weather',
        items: [
          'In case of weather, a reschedule may be requested up to 72 hours before.',
        ],
      },
      {
        id: 'request',
        label: 'How to request',
        items: [
          'Cancellation requests must be made by WhatsApp or text message.',
          'The request must be approved.',
          `Contact: ${CDL_CANCEL_CONTACT_PHONE}`,
        ],
      },
    ],
  },
  es: {
    title: 'Política de Cancelación',
    acceptLabel: 'He leído y acepto la Política de Cancelación.',
    windows: [
      {
        id: '72h',
        label: 'Hasta 72h',
        items: [
          'Solicitud hasta 72 horas antes del evento.',
          'Reprogramación para los próximos 3 meses.',
          'El valor total pagado del anticipo puede aplicarse al próximo evento.',
        ],
      },
      {
        id: '48h',
        label: 'Hasta 48h',
        items: [
          'Solicitud hasta 48 horas antes del evento.',
          'Se descuenta el 50% del valor ya pagado del anticipo.',
          'Reprogramación para los próximos 3 meses.',
          'Solo el 50% del anticipo se considera para el próximo evento.',
        ],
      },
      {
        id: 'lt48h',
        label: 'Menos de 48h',
        items: [
          'Solicitud con menos de 48 horas de anticipación.',
          'El valor total del anticipo se pierde.',
          'Sin reembolso.',
          'Sin reprogramación.',
        ],
      },
    ],
    extras: [
      {
        id: 'rebook',
        label: 'Reprogramación',
        items: [
          'La reprogramación está sujeta a disponibilidad.',
          'Límite de 1 reprogramación.',
          'No hay reembolso.',
        ],
      },
      {
        id: 'transfer',
        label: 'Transferencia de crédito',
        items: [
          'El crédito puede transferirse a terceros, respetando esta política.',
        ],
      },
      {
        id: 'weather',
        label: 'Clima',
        items: [
          'En caso de clima, la reprogramación puede solicitarse hasta 72 horas antes.',
        ],
      },
      {
        id: 'request',
        label: 'Cómo solicitar',
        items: [
          'La solicitud de cancelación debe hacerse por WhatsApp o mensaje de texto.',
          'La solicitud necesita ser aprobada.',
          `Contacto: ${CDL_CANCEL_CONTACT_PHONE}`,
        ],
      },
    ],
  },
}

export function getCancellationPolicyCopy(
  language: QuoteLanguage | string | null | undefined,
): CancellationPolicyCopy {
  if (language === 'en' || language === 'es') return COPY[language]
  return COPY.pt
}

export function flattenCancellationPolicyText(
  language: QuoteLanguage | string | null | undefined,
): string[] {
  const copy = getCancellationPolicyCopy(language)
  return [
    ...copy.windows.flatMap((section) => [
      `${section.label}: ${section.items.join(' ')}`,
    ]),
    ...copy.extras.flatMap((section) => [
      `${section.label}: ${section.items.join(' ')}`,
    ]),
  ]
}

export function cancellationPolicyMentionsFake24h(
  language: QuoteLanguage | string | null | undefined,
): boolean {
  return flattenCancellationPolicyText(language).some((line) =>
    /\b24\s*h(oras|ours|oras)?\b/i.test(line),
  )
}
