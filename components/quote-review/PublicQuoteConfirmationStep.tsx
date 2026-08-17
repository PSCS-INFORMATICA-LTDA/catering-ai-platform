'use client'

import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'
import type { QuoteLanguage, WizardState } from '@/Lib/quoteWizardTypes'

const COPY = {
  pt: {
    title: 'Revise seu evento',
    subtitle: 'Confira os dados antes de enviar para nossa equipe.',
    contact: 'Contato',
    event: 'Evento',
    package: 'Pacote',
    guests: 'Convidados',
    grill: 'Estrutura da churrasqueira',
    yes: 'Churrasqueira disponível; foto anexada',
    rental: 'Incluir locação de churrasqueira',
    noRental: 'Sem churrasqueira e sem locação',
    estimate: 'Estimativa do evento',
    deposit: 'Sinal estimado',
    balance: 'Saldo estimado',
    back: 'Voltar e editar',
    submit: 'Enviar solicitação',
    submitting: 'Enviando com segurança…',
    pricing: 'Calculando a estimativa…',
    mileagePending:
      'Deslocamento pendente de revisão. A equipe confirma o valor final antes da aprovação.',
    consentRequired: 'Aceite o consentimento para enviar.',
    genericError: 'Não foi possível enviar agora. Revise os dados e tente novamente.',
    review: 'Revisão',
    edit: 'Editar',
    adults: 'adultos',
    children: 'crianças',
    toddlers: 'pequenos',
    privacy: 'Privacidade',
  },
  en: {
    title: 'Review your event',
    subtitle: 'Check the details before sending them to our team.',
    contact: 'Contact',
    event: 'Event',
    package: 'Package',
    guests: 'Guests',
    grill: 'Grill setup',
    yes: 'Grill available; photo attached',
    rental: 'Include grill rental',
    noRental: 'No grill and no rental',
    estimate: 'Event estimate',
    deposit: 'Estimated deposit',
    balance: 'Estimated balance',
    back: 'Back and edit',
    submit: 'Send request',
    submitting: 'Sending securely…',
    pricing: 'Calculating estimate…',
    mileagePending:
      'Travel is pending review. The team confirms the final amount before approval.',
    consentRequired: 'Accept the consent to submit.',
    genericError: 'We could not submit right now. Review the details and try again.',
    review: 'Review',
    edit: 'Edit',
    adults: 'adults',
    children: 'children',
    toddlers: 'toddlers',
    privacy: 'Privacy',
  },
  es: {
    title: 'Revisa tu evento',
    subtitle: 'Confirma los datos antes de enviarlos a nuestro equipo.',
    contact: 'Contacto',
    event: 'Evento',
    package: 'Paquete',
    guests: 'Invitados',
    grill: 'Estructura de parrilla',
    yes: 'Parrilla disponible; foto adjunta',
    rental: 'Incluir alquiler de parrilla',
    noRental: 'Sin parrilla y sin alquiler',
    estimate: 'Estimación del evento',
    deposit: 'Señal estimada',
    balance: 'Saldo estimado',
    back: 'Volver y editar',
    submit: 'Enviar solicitud',
    submitting: 'Enviando de forma segura…',
    pricing: 'Calculando la estimación…',
    mileagePending:
      'El desplazamiento está pendiente de revisión. El equipo confirma el valor final antes de la aprobación.',
    consentRequired: 'Acepta el consentimiento para enviar.',
    genericError: 'No pudimos enviar ahora. Revisa los datos e inténtalo de nuevo.',
    review: 'Revisión',
    edit: 'Editar',
    adults: 'adultos',
    children: 'niños',
    toddlers: 'pequeños',
    privacy: 'Privacidad',
  },
} as const

function formatMoney(value: number, language: QuoteLanguage, currency: string) {
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-US' : 'pt-BR'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

function SummaryCard({
  label,
  children,
  onEdit,
  editLabel,
}: {
  label: string
  children: React.ReactNode
  onEdit: () => void
  editLabel: string
}) {
  return (
    <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-cdl-muted">
          {label}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-bold text-[var(--brand-primary)] underline-offset-4 hover:underline"
        >
          {editLabel}
        </button>
      </div>
      <div className="mt-3 text-sm leading-6 text-cdl-title">{children}</div>
    </section>
  )
}

export default function PublicQuoteConfirmationStep({
  state,
  breakdown,
  packageName,
  currency = 'USD',
  language,
  consentLabel,
  privacyUrl,
  mileageReviewRequired = false,
  saving,
  error,
  onConsentChange,
  onGoToStep,
  onBack,
  onSubmit,
}: {
  state: WizardState
  breakdown: PricingBreakdown | null
  packageName: string | null
  currency?: string
  language: QuoteLanguage
  consentLabel: string
  privacyUrl?: string | null
  mileageReviewRequired?: boolean
  saving: boolean
  error: boolean
  onConsentChange: (accepted: boolean) => void
  onGoToStep: (step: number) => void
  onBack: () => void
  onSubmit: () => void
}) {
  const copy = COPY[language]
  const guestCount =
    state.adultCount + state.childrenUnder3Count + state.children4To12Count
  const address =
    state.addressFormatted ||
    [
      [state.address, state.addressNumber].filter(Boolean).join(', '),
      state.city,
      state.state,
      state.zipCode,
    ]
      .filter(Boolean)
      .join(' · ')
  const disabled = saving || !breakdown || !state.publicConsentAccepted

  return (
    <div className="space-y-6 pb-8">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
          06 · {copy.review}
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-cdl-title">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm text-cdl-muted">{copy.subtitle}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard label={copy.contact} editLabel={copy.edit} onEdit={() => onGoToStep(0)}>
          <p className="font-bold">
            {[state.customerFirstName, state.customerLastName].filter(Boolean).join(' ')}
          </p>
          <p>{state.customerDraftPhone}</p>
          {state.customerDraftEmail ? <p>{state.customerDraftEmail}</p> : null}
        </SummaryCard>
        <SummaryCard label={copy.event} editLabel={copy.edit} onEdit={() => onGoToStep(1)}>
          <p className="font-bold">
            {state.eventDate} · {state.startTime}–{state.endTime}
          </p>
          <p>{address}</p>
        </SummaryCard>
        <SummaryCard label={copy.package} editLabel={copy.edit} onEdit={() => onGoToStep(2)}>
          <p className="font-bold">{packageName || '—'}</p>
        </SummaryCard>
        <SummaryCard label={copy.guests} editLabel={copy.edit} onEdit={() => onGoToStep(1)}>
          <p className="font-bold">{guestCount}</p>
          <p>
            {state.adultCount} {copy.adults} · {state.children4To12Count}{' '}
            {copy.children} · {state.childrenUnder3Count} {copy.toddlers}
          </p>
        </SummaryCard>
        <SummaryCard label={copy.grill} editLabel={copy.edit} onEdit={() => onGoToStep(4)}>
          <p className="font-bold">
            {state.hasGrill
              ? copy.yes
              : state.grillRentalRequired
                ? `${copy.rental} · ${state.grillRentalQty}`
                : copy.noRental}
          </p>
          {state.grillNotes ? <p>{state.grillNotes}</p> : null}
        </SummaryCard>
        <section className="rounded-2xl border border-[var(--brand-primary-2)] bg-[color-mix(in_srgb,var(--brand-primary)_7%,white)] p-5 shadow-sm">
          {breakdown ? (
            <>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cdl-muted">
                {copy.estimate}
              </p>
              <p className="mt-2 text-3xl font-black text-cdl-title">
                {formatMoney(breakdown.total, language, currency)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-cdl-muted">
                <p>
                  {copy.deposit}
                  <strong className="mt-1 block text-sm text-cdl-title">
                    {formatMoney(breakdown.deposit, language, currency)}
                  </strong>
                </p>
                <p>
                  {copy.balance}
                  <strong className="mt-1 block text-sm text-cdl-title">
                    {formatMoney(breakdown.balance, language, currency)}
                  </strong>
                </p>
              </div>
              {mileageReviewRequired ? (
                <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                  {copy.mileagePending}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-cdl-muted">{copy.pricing}</p>
          )}
        </section>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-cdl-border bg-cdl-surface p-5">
        <input
          type="checkbox"
          checked={state.publicConsentAccepted}
          onChange={(event) => onConsentChange(event.target.checked)}
          className="mt-1 h-5 w-5 accent-[var(--brand-primary)]"
        />
        <span className="text-sm leading-6 text-cdl-text-secondary">
          {consentLabel}{' '}
          {privacyUrl ? (
            <a
              href={privacyUrl}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-[var(--brand-primary)] underline"
            >
              {copy.privacy}
            </a>
          ) : null}
        </span>
      </label>
      {!state.publicConsentAccepted ? (
        <p className="text-sm text-cdl-muted">{copy.consentRequired}</p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {copy.genericError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-cdl-border bg-cdl-surface px-6 py-3 text-sm font-bold"
        >
          {copy.back}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onSubmit}
          className="cdl-btn-primary min-h-12 px-8 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? copy.submitting : copy.submit}
        </button>
      </div>
    </div>
  )
}
