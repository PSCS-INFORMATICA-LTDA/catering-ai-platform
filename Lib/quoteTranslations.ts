import type { QuoteLanguage } from './quoteWizardTypes.ts'

export const WIZARD_STEP_KEYS = [
  'customer',
  'event',
  'package',
  'additionals',
  'bbq',
  'details',
  'summary',
  'confirmation',
] as const

const CATEGORY_LABEL_MAP: Record<string, Record<QuoteLanguage, string>> = {
  BOVINO_TRADICIONAL: {
    pt: 'Bovino Tradicional',
    en: 'Traditional Beef',
    es: 'Carne Tradicional',
  },
  BOVINO_NOBRE: {
    pt: 'Bovino Nobre',
    en: 'Premium Beef',
    es: 'Carne Premium',
  },
  LINGUICAS: {
    pt: 'Linguiças',
    en: 'Sausages',
    es: 'Embutidos',
  },
  FRANGO: {
    pt: 'Frango',
    en: 'Chicken',
    es: 'Pollo',
  },
  FRUTOS_DO_MAR: {
    pt: 'Frutos do Mar',
    en: 'Seafood',
    es: 'Mariscos',
  },
  PEIXES: {
    pt: 'Peixes',
    en: 'Fish',
    es: 'Pescados',
  },
  PORCO: {
    pt: 'Porco',
    en: 'Pork',
    es: 'Cerdo',
  },
  CORDEIRO: {
    pt: 'Cordeiro',
    en: 'Lamb',
    es: 'Cordero',
  },
  GUARNICOES: {
    pt: 'Guarnições',
    en: 'Sides',
    es: 'Guarniciones',
  },
  EQUIPAMENTOS: {
    pt: 'Equipamentos',
    en: 'Equipment',
    es: 'Equipos',
  },
  LEGUMES_E_SALADAS: {
    pt: 'Legumes e Saladas',
    en: 'Vegetables & Salads',
    es: 'Verduras y Ensaladas',
  },
  OUTROS: {
    pt: 'Outros',
    en: 'Other',
    es: 'Otros',
  },
}

const CATEGORY_SORT_ORDER = [
  'BOVINO_TRADICIONAL',
  'BOVINO_NOBRE',
  'LINGUICAS',
  'FRANGO',
  'FRUTOS_DO_MAR',
  'PEIXES',
  'PORCO',
  'CORDEIRO',
  'GUARNICOES',
  'LEGUMES_E_SALADAS',
  'EQUIPAMENTOS',
  'OUTROS',
] as const

type QuoteStrings = {
  newQuoteTitle: string
  editQuoteTitle: string
    backToQuotes: string
    backToQuote: string
    documentLanguage: string
    documentLanguageHint: string
    customerLocked: string
    customerNotLinked: string
    currentCustomer: string
  stepSubtitles: Record<number, string>
  wizardSteps: string[]
  next: string
  back: string
  select: string
  selected: string
  perPerson: string
  perUnit: string
  photoPending: string
  itemsCount: (count: number) => string
  selectedCount: (count: number) => string
  noAdditionalsAvailable: string
  continueToBbq: string
  additionalsStepHint: string
  addUnit: string
  removeUnit: string
  eachUnit: (pack: string) => string
  totalWeight: (amount: number, uom: string) => string
  stepperAdditionals: (count: number) => string
  review: {
    packageSection: string
    guestsSection: string
    eventSection: string
    bbqSection: string
    mileageSection: string
    reservationSection: string
    additionalsSection: string
    noAdditionals: string
    date: string
    time: string
    location: string
    quoteTotal: string
    summary: string
    createQuote: string
    saveChanges: string
    saving: string
    creating: string
    cancel: string
  }
  nav: {
    newQuote: string
    quotes: string
    customers: string
    packages: string
    itemCatalog: string
    rules: string
    images: string
  }
}

const STRINGS: Record<QuoteLanguage, QuoteStrings> = {
  pt: {
    newQuoteTitle: 'Nova cotação CDL',
    editQuoteTitle: 'Editar cotação CDL',
    backToQuotes: '← Voltar às cotações',
    backToQuote: '← Voltar para cotação',
    documentLanguage: 'Idioma da cotação',
    documentLanguageHint:
      'Usado no PDF, visualização pública e comunicações com o cliente — não troca a interface do operador.',
    customerLocked: 'O cliente não pode ser alterado nesta tela.',
    customerNotLinked:
      'Cliente ainda não vinculado. A cotação pode ser criada, mas deverá ser revisada antes do envio final.',
    currentCustomer: 'Cliente atual',
    stepSubtitles: {
      0: 'Identifique o cliente para começar a cotação.',
      1: 'Informe data, local e detalhes do evento.',
      2: 'Escolha o pacote e confira as opções disponíveis.',
      3: 'Selecione itens extras, se desejar.',
      4: 'Configure churrasqueira e equipamentos.',
      5: 'Informe distância e dados de deslocamento.',
      6: 'Defina reserva e pagamento inicial.',
      7: 'Revise tudo antes de confirmar.',
    },
    wizardSteps: [
      'Cliente',
      'Evento',
      'Pacote',
      'Adicionais',
      'Churrasco',
      'Dados',
      'Resumo',
      'Confirmação',
    ],
    next: 'Próximo',
    back: 'Voltar',
    select: 'Selecionar',
    selected: 'Selecionado',
    perPerson: 'por pessoa',
    perUnit: 'Por unidade',
    photoPending: 'Foto pendente',
    itemsCount: (count) =>
      `${count} ${count === 1 ? 'item' : 'itens'}`,
    selectedCount: (count) =>
      `${count} selecionado${count !== 1 ? 's' : ''}`,
    noAdditionalsAvailable: 'Nenhum adicional disponível.',
    continueToBbq: 'Continuar para Churrasqueira →',
    additionalsStepHint: 'Escolha os itens extras para complementar a cotação.',
    addUnit: 'Adicionar unidade',
    removeUnit: 'Remover unidade',
    eachUnit: (pack) => `Cada unidade: ${pack}`,
    totalWeight: (amount, uom) => `${amount} ${uom} total`,
    stepperAdditionals: (count) => `Adicionais · ${count} adicionais`,
    review: {
      packageSection: 'Pacote CDL',
      guestsSection: 'Convidados e cobrança',
      eventSection: 'Evento',
      bbqSection: 'Churrasqueira',
      mileageSection: 'Milhagem',
      reservationSection: 'Reserva',
      additionalsSection: 'Adicionais',
      noAdditionals: 'Nenhum adicional selecionado.',
      date: 'Data',
      time: 'Horário',
      location: 'Local',
      quoteTotal: 'Total da cotação',
      summary: 'Resumo',
      createQuote: 'Criar cotação',
      saveChanges: 'Salvar alterações',
      saving: 'Salvando…',
      creating: 'Criando cotação...',
      cancel: 'Cancelar',
    },
    nav: {
      newQuote: 'Nova cotação',
      quotes: 'Cotações',
      customers: 'Cadastros',
      packages: 'Pacotes',
      itemCatalog: 'Cadastro de itens',
      rules: 'Regras',
      images: 'Imagens',
    },
  },
  en: {
    newQuoteTitle: 'New CDL quote',
    editQuoteTitle: 'Edit CDL quote',
    backToQuotes: '← Back to quotes',
    backToQuote: '← Back to quote',
    documentLanguage: 'Quote language',
    documentLanguageHint:
      'Used for PDF, public proposal and customer messages — does not switch the operator UI.',
    customerLocked: 'The customer cannot be changed on this screen.',
    customerNotLinked:
      'Customer not linked yet. The quote can be created, but must be reviewed before final send.',
    currentCustomer: 'Current customer',
    stepSubtitles: {
      0: 'Identify the customer to start the quote.',
      1: 'Enter date, location, and event details.',
      2: 'Choose the package and review available options.',
      3: 'Select extra items, if needed.',
      4: 'Configure grill and equipment.',
      5: 'Enter distance and travel details.',
      6: 'Set deposit and initial payment.',
      7: 'Review everything before confirming.',
    },
    wizardSteps: [
      'Customer',
      'Event',
      'Package',
      'Extras',
      'BBQ Setup',
      'Details',
      'Summary',
      'Confirmation',
    ],
    next: 'Next',
    back: 'Back',
    select: 'Select',
    selected: 'Selected',
    perPerson: 'per person',
    perUnit: 'Per unit',
    photoPending: 'Photo pending',
    itemsCount: (count) => `${count} ${count === 1 ? 'item' : 'items'}`,
    selectedCount: (count) => `${count} selected`,
    noAdditionalsAvailable: 'No additional items available.',
    continueToBbq: 'Continue to BBQ Setup →',
    additionalsStepHint: 'Choose extra items to complement the quote.',
    addUnit: 'Add unit',
    removeUnit: 'Remove unit',
    eachUnit: (pack) => `Each unit: ${pack}`,
    totalWeight: (amount, uom) => `${amount} ${uom} total`,
    stepperAdditionals: (count) => `Extras · ${count} items`,
    review: {
      packageSection: 'CDL Package',
      guestsSection: 'Guests & billing',
      eventSection: 'Event',
      bbqSection: 'BBQ Setup',
      mileageSection: 'Mileage',
      reservationSection: 'Deposit',
      additionalsSection: 'Additional Items',
      noAdditionals: 'No additional items selected.',
      date: 'Date',
      time: 'Time',
      location: 'Location',
      quoteTotal: 'Quote total',
      summary: 'Summary',
      createQuote: 'Create quote',
      saveChanges: 'Save changes',
      saving: 'Saving…',
      creating: 'Creating quote...',
      cancel: 'Cancel',
    },
    nav: {
      newQuote: 'New quote',
      quotes: 'Quotes',
      customers: 'Records',
      packages: 'Packages',
      itemCatalog: 'Item catalog',
      rules: 'Rules',
      images: 'Images',
    },
  },
  es: {
    newQuoteTitle: 'Nueva cotización CDL',
    editQuoteTitle: 'Editar cotización CDL',
    backToQuotes: '← Volver a cotizaciones',
    backToQuote: '← Volver a la cotización',
    documentLanguage: 'Idioma de la cotización',
    documentLanguageHint:
      'Se usa en PDF, propuesta pública y mensajes al cliente — no cambia la interfaz del operador.',
    customerLocked: 'El cliente no puede cambiarse en esta pantalla.',
    customerNotLinked:
      'Cliente aún no vinculado. La cotización puede crearse, pero debe revisarse antes del envío final.',
    currentCustomer: 'Cliente actual',
    stepSubtitles: {
      0: 'Identifique al cliente para comenzar la cotización.',
      1: 'Indique fecha, lugar y detalles del evento.',
      2: 'Elija el paquete y revise las opciones disponibles.',
      3: 'Seleccione artículos extra, si desea.',
      4: 'Configure parrilla y equipos.',
      5: 'Indique distancia y datos de desplazamiento.',
      6: 'Defina reserva y pago inicial.',
      7: 'Revise todo antes de confirmar.',
    },
    wizardSteps: [
      'Cliente',
      'Evento',
      'Paquete',
      'Adicionales',
      'Parrilla',
      'Datos',
      'Resumen',
      'Confirmación',
    ],
    next: 'Siguiente',
    back: 'Volver',
    select: 'Seleccionar',
    selected: 'Seleccionado',
    perPerson: 'por persona',
    perUnit: 'Por unidad',
    photoPending: 'Foto pendiente',
    itemsCount: (count) =>
      `${count} ${count === 1 ? 'artículo' : 'artículos'}`,
    selectedCount: (count) => `${count} seleccionado${count !== 1 ? 's' : ''}`,
    noAdditionalsAvailable: 'No hay artículos adicionales disponibles.',
    continueToBbq: 'Continuar a Parrilla →',
    additionalsStepHint:
      'Elija artículos extra para complementar la cotización.',
    addUnit: 'Agregar unidad',
    removeUnit: 'Quitar unidad',
    eachUnit: (pack) => `Cada unidad: ${pack}`,
    totalWeight: (amount, uom) => `${amount} ${uom} total`,
    stepperAdditionals: (count) => `Adicionales · ${count} artículos`,
    review: {
      packageSection: 'Paquete CDL',
      guestsSection: 'Invitados y cobro',
      eventSection: 'Evento',
      bbqSection: 'Parrilla',
      mileageSection: 'Kilometraje',
      reservationSection: 'Reserva',
      additionalsSection: 'Adicionales',
      noAdditionals: 'Ningún adicional seleccionado.',
      date: 'Fecha',
      time: 'Horario',
      location: 'Lugar',
      quoteTotal: 'Total de la cotización',
      summary: 'Resumen',
      createQuote: 'Crear cotización',
      saveChanges: 'Guardar cambios',
      saving: 'Guardando…',
      creating: 'Creando cotización...',
      cancel: 'Cancelar',
    },
    nav: {
      newQuote: 'Nueva cotización',
      quotes: 'Cotizaciones',
      customers: 'Registros',
      packages: 'Paquetes',
      itemCatalog: 'Catálogo de ítems',
      rules: 'Reglas',
      images: 'Imágenes',
    },
  },
}

export function getQuoteStrings(language: QuoteLanguage = 'pt'): QuoteStrings {
  return STRINGS[language] ?? STRINGS.pt
}

function flattenLocaleTree(
  value: unknown,
  prefix: string,
  acc: Record<string, string | '((fn))'>,
) {
  if (typeof value === 'function') {
    acc[prefix] = '((fn))'
    return
  }
  if (typeof value === 'string') {
    acc[prefix] = value
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => flattenLocaleTree(item, `${prefix}.${i}`, acc))
    return
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flattenLocaleTree(v, prefix ? `${prefix}.${k}` : k, acc)
    }
  }
}

export function listQuoteWizardI18nEntries(): Array<{
  key: string
  module: string
  context: string
  pt: string
  en: string
  es: string
}> {
  const pt: Record<string, string | '((fn))'> = {}
  const en: Record<string, string | '((fn))'> = {}
  const es: Record<string, string | '((fn))'> = {}
  flattenLocaleTree(STRINGS.pt, '', pt)
  flattenLocaleTree(STRINGS.en, '', en)
  flattenLocaleTree(STRINGS.es, '', es)
  const keys = new Set([...Object.keys(pt), ...Object.keys(en), ...Object.keys(es)])
  return [...keys].sort().map((leaf) => ({
    key: `quotes.wizard.${leaf}`,
    module: 'quotes',
    context: leaf.startsWith('review') ? 'document' : 'ui',
    pt: String(pt[leaf] ?? ''),
    en: String(en[leaf] ?? ''),
    es: String(es[leaf] ?? ''),
  }))
}

export function normalizeCategoryKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
}

export function getCategoryLabel(
  categoryKey: string,
  locale: QuoteLanguage,
  fallbackItem?: {
    category_pt?: string | null
    category_en?: string | null
    category_es?: string | null
  } | null,
): string {
  const key = normalizeCategoryKey(categoryKey)
  const mapped = CATEGORY_LABEL_MAP[key]
  if (mapped) return mapped[locale]

  if (locale === 'en') {
    return fallbackItem?.category_en?.trim() || fallbackItem?.category_pt?.trim() || key
  }
  if (locale === 'es') {
    return fallbackItem?.category_es?.trim() || fallbackItem?.category_pt?.trim() || key
  }
  return fallbackItem?.category_pt?.trim() || key
}

export function getCategorySortIndex(categoryKey: string): number {
  const key = normalizeCategoryKey(categoryKey)
  const index = CATEGORY_SORT_ORDER.indexOf(
    key as (typeof CATEGORY_SORT_ORDER)[number],
  )
  return index === -1 ? CATEGORY_SORT_ORDER.length : index
}

export function compareCategoryKeys(a: string, b: string): number {
  const diff = getCategorySortIndex(a) - getCategorySortIndex(b)
  if (diff !== 0) return diff
  return a.localeCompare(b)
}
