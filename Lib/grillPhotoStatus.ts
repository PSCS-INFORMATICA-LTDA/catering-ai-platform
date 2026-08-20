export type GrillPhotoStatus = 'received' | 'pending' | 'not_applicable'

export type GrillPhotoStatusInput = {
  hasGrill?: boolean | null
  grillPhotoRequired?: boolean | null
  grillPhotoUrl?: string | null
  grillPhotoMediaId?: string | null
}

export function deriveGrillPhotoStatus(
  input: GrillPhotoStatusInput,
): GrillPhotoStatus {
  if (input.hasGrill === false) return 'not_applicable'
  if (input.hasGrill !== true) return 'not_applicable'

  if (input.grillPhotoUrl?.trim() || input.grillPhotoMediaId?.trim()) {
    return 'received'
  }

  if (input.grillPhotoRequired) return 'pending'
  return 'received'
}

export function grillPhotoStatusToRequired(status: GrillPhotoStatus): boolean {
  return status === 'pending'
}

export function getGrillPhotoStatusLabel(
  status: GrillPhotoStatus,
  locale: string | null | undefined = 'pt',
): string {
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt'
  switch (status) {
    case 'received':
      return loc === 'en' ? 'Yes' : loc === 'es' ? 'Sí' : 'Sim'
    case 'pending':
      return loc === 'en' ? 'Pending' : loc === 'es' ? 'Pendiente' : 'Pendente'
    case 'not_applicable':
      return loc === 'en'
        ? 'Not applicable'
        : loc === 'es'
          ? 'No aplica'
          : 'Não se aplica'
    default:
      return '—'
  }
}

/** Rótulo para detalhe/PDF da cotação */
export function getGrillPhotoDetailLabel(
  input: GrillPhotoStatusInput,
  locale: string | null | undefined = 'pt',
): string {
  const status = deriveGrillPhotoStatus(input)
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt'
  switch (status) {
    case 'received':
      return loc === 'en' ? 'Confirmed' : loc === 'es' ? 'Confirmada' : 'Confirmada'
    case 'pending':
      return loc === 'en' ? 'Pending' : loc === 'es' ? 'Pendiente' : 'Pendente'
    case 'not_applicable':
      return loc === 'en'
        ? 'Not applicable'
        : loc === 'es'
          ? 'No aplica'
          : 'Não se aplica'
    default:
      return '—'
  }
}

export function getGrillPhotoBadgeLabel(
  status: GrillPhotoStatus,
  locale: string | null | undefined = 'pt',
): string {
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt'
  switch (status) {
    case 'received':
      return loc === 'en' ? 'Received' : loc === 'es' ? 'Recibida' : 'Recebida'
    case 'pending':
      return loc === 'en' ? 'Pending' : loc === 'es' ? 'Pendiente' : 'Pendente'
    case 'not_applicable':
      return loc === 'en' ? 'N/A' : loc === 'es' ? 'No aplica' : 'Não aplica'
    default:
      return '—'
  }
}
