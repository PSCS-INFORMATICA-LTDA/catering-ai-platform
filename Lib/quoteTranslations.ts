import type { QuoteLanguage } from './quoteWizardTypes.ts'
import { fillTemplate } from './i18n/makeModule.ts'

export const WIZARD_STEP_KEYS = [
  'customer',
  'event',
  'package',
  'additionals',
  'bbq',
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
  wizardStepsShort: string[]
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
  wizard: {
    langPt: string
    langEn: string
    langEs: string
    selectDate: string
    selectTime: string
    prevMonth: string
    nextMonth: string
    calendarOf: string
    timePickerOf: string
    hour: string
    minutes: string
    customerPhone: string
    customerName: string
    customerEmail: string
    contactNamePlaceholder: string
    searchExistingCustomer: string
    searchCustomerPlaceholder: string
    customersFound: string
    searching: string
    noCustomersFound: string
    searchHint: string
    linkingCustomer: string
    customerLinked: string
    refreshCustomersError: string
    refreshCustomersListError: string
    linkedCustomerNotFound: string
    lookupByPhoneError: string
    existingCustomerLinked: string
    newCustomerDraft: string
    networkLookupError: string
    eventName: string
    eventNamePlaceholder: string
    eventDate: string
    startTime: string
    endTime: string
    endTimeHint: string
    endTimeHintPublic: string
    publicPhoneHint: string
    publicPhonePlaceholder: string
    firstName: string
    lastName: string
    contactPrivacyHint: string
    publicPackageOptionsTitle: string
    publicPackageChooseHint: string
    pricingRetry: string
    pricingTimeout: string
    pricingRateLimited: string
    pricingMissingPackage: string
    chargeUnitPerPerson: string
    chargeUnitPerUnit: string
    chargeUnitPerPortion: string
    chargeUnitFixed: string
    priceUnavailable: string
    mileageDistanceMiKm: string
    mileageRuleLabel: string
    mileageRuleSummary: string
    adults: string
    childrenUnder3: string
    children4to12: string
    hasGrill: string
    grillPhotoReceived: string
    yes: string
    no: string
    notApplicable: string
    pending: string
    photoConfirmed: string
    photoPendingHint: string
    attachGrillPhoto: string
    grillPhotoHint: string
    grillRentalRequired: string
    grillRentalQty: string
    grillNotes: string
    grillNotesPlaceholder: string
    mileageBaseHint: string
    baseLocation: string
    baseLocationPlaceholder: string
    distanceMi: string
    freeLimitMi: string
    ratePerMi: string
    mileageSummary: string
    totalMiles: string
    includedMiles: string
    chargedMiles: string
    calculatedFee: string
    quoteTotal: string
    reservationPct: string
    reservationAmount: string
    reservationRecalcHint: string
    reservationNotesPlaceholder: string
    notes: string
    customerNotLinkedShort: string
    pendingPreviousSteps: string
    packageNotSelected: string
    packageNotInCatalog: string
    quoteNotCreated: string
    selectPackageToContinue: string
    nextCompleteOptions: string
    googleSearchLabel: string
    googleSearchPlaceholder: string
    googleLoading: string
    googleLoadError: string
    googleApiKeyMissing: string
    addressPlaceholder: string
    addressSelectionRequired: string
    addressZipMismatch: string
    cityPlaceholder: string
    statePlaceholder: string
    zipPlaceholder: string
    issueEventName: string
    issueEventDate: string
    issueStartTime: string
    issueEndTime: string
    issueAddress: string
    issueCity: string
    issueState: string
    issueZip: string
    issueAdults: string
    issueSelectPackage: string
    issueNoAdditionals: string
    issueHasGrill: string
    issueGrillQty: string
    issueBase: string
    issueDistance: string
    issueFreeLimit: string
    issueRate: string
    issueReservationPct: string
    issueReservationAmount: string
    issueIncompleteSteps: string
    grillPhotoPendingWarning: string
    noPackages: string
    withSides: string
    withoutSides: string
    packageValue: string
    totalPerPerson: string
    garnish: string
    highlight: string
    highlights: string
    includedItems: string
    packageHighlights: string
    meatsCategory: string
    sausagesCategory: string
    packageItemsCategory: string
    condimentsCategory: string
    customPackageHint: string
    itemsConfiguring: string
    includedSides: string
    price: string
    packageImage: string
    packageImageMissing: string
    packageSummary: string
    packagePriceLabel: string
    garnishPriceLabel: string
    garnishIncluded: string
    total: string
    required: string
    chooseOption: string
    optionsUnavailable: string
    includedChoices: string
    packageItems: string
    additionalItems: string
    none: string
    notIncluded: string
    billedPeople: string
    basePackageValue: string
    garnishValue: string
    packageTotal: string
    extrasOnQuote: string
    minOrderAdjustment: string
    reservationDeposit: string
    grillToRent: string
    additionalCount: string
    preview: string
    beforeSave: string
    draft: string
    reservationPctLabel: string
    reservationAmountLabel: string
    minOrderAppliedNote: string
    holidaySurchargeNote: string
    reservationBalanceLine: string
    quoteProgress: string
    stepsCompleted: string
    completionPercent: string
    readyToGenerate: string
    missingMandatory: string
    pendingTitle: string
    quoteReadyToSave: string
    goToStep: string
    warningPrefix: string
    saveFailed: string
    createFailed: string
    technicalError: string
    rawError: string
    commercialAdjustment: string
    subtotalLine: string
    minOrderRaised: string
    guestRule: string
    fetchErrorCustomers: string
    fetchErrorPackages: string
    fetchErrorCatalog: string
    fetchErrorPackageConfig: string
    fetchErrorEmptyPackages: string
    fetchErrorQuote: string
    fetchErrorEvent: string
    fetchErrorLinkedPackage: string
    fetchErrorQuoteAdditionals: string
    fetchErrorPackageSelections: string
    loadQuoteError: string
    quoteNotFound: string
    pdfFailed: string
    pdfDownloadError: string
    generatingPdf: string
    downloadPdf: string
    quoteCreated: string
    quoteUpdated: string
    details: string
    lessDetails: string
    billed: string
    miles: string
    mileageFeeShort: string
    additionalShort: string
    grillShort: string
    photoShort: string
    printTitle: string
    photoUpdating: string
    finalChoice: string
    includedSidesColon: string
    listAnd: string
    listOr: string
    optionFallback: string
    seafoodOption: string
    ribOption: string
    sideOption: string
    comingSoon: string
    refresh: string
    refreshing: string
    physicalGuests: string
    billableGuests: string
    totalToPay: string
    reservationRuleHint: string
    pricingCalculating: string
    pricingCalcError: string
    breakdownPackage: string
    breakdownAdditional: string
    breakdownMileage: string
    breakdownGrillRental: string
    breakdownHoliday: string
    breakdownMinimum: string
    breakdownDiscount: string
    breakdownSubtotal: string
    breakdownDeposit: string
    breakdownBalance: string
    breakdownDepositPct: string
    confirmSectionClient: string
    confirmSectionEvent: string
    confirmSectionGuests: string
    confirmSectionPackage: string
    confirmSectionAdditionals: string
    confirmSectionGrill: string
    confirmSectionMileage: string
    confirmSectionFinancial: string
    confirmSectionRules: string
    confirmSectionCancellation: string
    categoriesReviewRequired: string
    categoriesReviewComplete: string
    categoriesReviewPendingHeading: string
    categoryReviewStatusReviewed: string
    categoryReviewStatusPending: string
    grillPhotoRequiredError: string
    grillPendingPhoto: string
    grillPendingRentalQty: string
    stepPendingTitle: string
    packagesLoadError: string
    mileageOrigin: string
    mileageDestination: string
    mileageTotalDistance: string
    mileageIncluded: string
    mileageChargeable: string
    mileageRateLabel: string
    mileageFormula: string
    mileageFeeFinal: string
    grillAtLocation: string
    grillRentalValue: string
    editStep: string
    financialTotal: string
    additionalValue: string
    mileageValue: string
    importantRules: string
    cancellationPolicy: string
    extrasCount: string
    mileagePendingReview: string
    privacyLink: string
    publicSubmitRequest: string
    publicSubmittingRequest: string
    consentRequired: string
    publicSubmitError: string
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
      3: 'Adicione itens extras se quiser. A seleção é opcional.',
      4: 'Configure churrasqueira, foto e rental quando aplicável.',
      5: 'Revise e confirme a cotação comercial completa.',
    },
    wizardSteps: [
      'Cliente',
      'Evento',
      'Pacote',
      'Adicionais',
      'Churrasco',
      'Confirmação',
    ],
    wizardStepsShort: [
      'Cliente',
      'Evento',
      'Pacote',
      'Extras',
      'BBQ',
      'Revisão',
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
    wizard: {
      langPt: 'Português (PT)',
      langEn: 'English (EN)',
      langEs: 'Español (ES)',
      selectDate: 'Selecione a data',
      selectTime: 'Selecione o horário',
      prevMonth: 'Mês anterior',
      nextMonth: 'Próximo mês',
      calendarOf: 'Calendário de {label}',
      timePickerOf: 'Seletor de {label}',
      hour: 'Hora',
      minutes: 'Minutos',
      customerPhone: 'Telefone do cliente',
      customerName: 'Nome do cliente',
      customerEmail: 'E-mail',
      contactNamePlaceholder: 'Nome para contato',
      searchExistingCustomer: 'Pesquisar cliente existente',
      searchCustomerPlaceholder: 'Digite nome, telefone, e-mail ou AB number',
      customersFound: 'Clientes encontrados',
      searching: 'Buscando…',
      noCustomersFound: 'Nenhum cliente encontrado.',
      searchHint:
        'Digite para buscar no cadastro — a lista aparece suspensa abaixo do campo.',
      linkingCustomer: 'Buscando ou criando cliente pelo telefone…',
      customerLinked: 'Cliente vinculado',
      refreshCustomersError: 'Não foi possível atualizar clientes.',
      refreshCustomersListError: 'Erro ao atualizar lista de clientes.',
      linkedCustomerNotFound: 'Cliente vinculado não encontrado',
      lookupByPhoneError: 'Não foi possível buscar cliente pelo telefone.',
      existingCustomerLinked: 'Cliente existente vinculado.',
      newCustomerDraft:
        'Novo cliente — será cadastrado ao finalizar a cotação.',
      networkLookupError: 'Erro de rede ao buscar cliente.',
      eventName: 'Nome do evento',
      eventNamePlaceholder: 'Nome do evento',
      eventDate: 'Data do evento',
      startTime: 'Horário início',
      endTime: 'Horário fim',
      endTimeHint:
        'Preenchido automaticamente com +4h. Você pode alterar se quiser.',
      endTimeHintPublic:
        'Calculado automaticamente a partir do horário de início. Não é possível editar.',
      publicPhoneHint:
        'Comece pelo código do país. Estados Unidos é +1; para outro país use o DDI, por exemplo +55.',
      publicPhonePlaceholder: 'Ex.: +1 407 555 0123',
      firstName: 'Primeiro nome',
      lastName: 'Sobrenome',
      contactPrivacyHint:
        'Usamos estes dados somente para preparar e acompanhar a sua solicitação.',
      publicPackageOptionsTitle: 'Opções deste pacote',
      publicPackageChooseHint:
        'Toque no pacote para selecionar. Depois complete apenas as opções obrigatórias.',
      pricingRetry: 'Tentar novamente',
      pricingTimeout: 'A estimativa demorou demais. Tente novamente.',
      pricingRateLimited:
        'Muitas tentativas de cálculo. Aguarde um instante e tente novamente.',
      pricingMissingPackage:
        'Selecione um pacote para calcular a estimativa.',
      chargeUnitPerPerson: 'por pessoa',
      chargeUnitPerUnit: 'por unidade',
      chargeUnitPerPortion: 'por porção',
      chargeUnitFixed: 'valor fixo',
      priceUnavailable: 'Preço a confirmar',
      mileageDistanceMiKm: '{mi} mi ({km} km)',
      mileageRuleLabel: 'Regra aplicada',
      mileageRuleSummary:
        'Até {included} mi inclusas. Acima disso, {rate} por milha.',
      adults: 'Adultos',
      childrenUnder3: 'Crianças até 3 anos',
      children4to12: 'Crianças 4 a 12 anos',
      hasGrill: 'Cliente tem churrasqueira?',
      grillPhotoReceived: 'Foto da churrasqueira recebida?',
      yes: 'Sim',
      no: 'Não',
      notApplicable: 'Não se aplica',
      pending: 'Pendente',
      photoConfirmed: 'Foto confirmada como recebida.',
      photoPendingHint: 'Foto ainda pendente para validação.',
      attachGrillPhoto: 'Anexar foto da churrasqueira',
      grillPhotoHint:
        'Se o cliente possui churrasqueira própria, confirme se a foto foi recebida para validar tamanho, condição e estrutura antes do evento.',
      grillRentalRequired: 'Necessário alugar churrasqueira?',
      grillRentalQty: 'Quantidade de churrasqueiras para aluguel',
      grillNotes: 'Observações sobre a churrasqueira',
      grillNotesPlaceholder:
        'Ex.: cliente possui churrasqueira, mas foto ainda pendente',
      mileageBaseHint:
        'Base atual: {base}. Até {limit} mi grátis. Acima de {limit} mi, aplicar regra comercial configurada.',
      baseLocation: 'Local base',
      baseLocationPlaceholder: 'Local base',
      distanceMi: 'Distância (mi)',
      freeLimitMi: 'Limite gratuito (mi)',
      ratePerMi: 'Taxa ($/mi)',
      mileageSummary: 'Resumo de milhagem',
      totalMiles: 'Milhas totais',
      includedMiles: 'Milhas inclusas',
      chargedMiles: 'Milhas cobradas',
      calculatedFee: 'Taxa calculada',
      quoteTotal: 'Total da cotação',
      reservationPct: 'Percentual de reserva (%)',
      reservationAmount: 'Valor da reserva ($)',
      reservationRecalcHint:
        'Percentual com até 3 casas decimais ou valor absoluto em $ — o outro campo é recalculado automaticamente. Reserva: {summary} · Saldo: {balance}',
      reservationNotesPlaceholder: 'Observações da reserva...',
      notes: 'Observações',
      customerNotLinkedShort: 'Cliente ainda não vinculado',
      pendingPreviousSteps:
        'Existem pendências obrigatórias nas etapas anteriores.',
      packageNotSelected: 'Pacote não selecionado.',
      packageNotInCatalog: 'Pacote selecionado não encontrado no catálogo.',
      quoteNotCreated: 'Cotação não foi criada — resposta sem id do Supabase.',
      selectPackageToContinue: 'Selecione um pacote para continuar.',
      nextCompleteOptions: 'Próximo — complete as opções obrigatórias',
      googleSearchLabel: 'Buscar endereço no Google',
      googleSearchPlaceholder: 'Digite o endereço para autocompletar...',
      googleLoading: 'Carregando Google Places...',
      googleLoadError: 'Não foi possível carregar o Google Places.',
      googleApiKeyMissing:
        'Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para buscar no Google.',
      addressPlaceholder: 'Endereço',
      addressSelectionRequired:
        'Digite a rua e selecione uma sugestão do Google para validar o trajeto.',
      addressZipMismatch:
        'Selecione um endereço que pertença ao CEP/ZIP informado.',
      cityPlaceholder: 'Cidade',
      statePlaceholder: 'Estado',
      zipPlaceholder: '01310-100',
      issueEventName: 'Informe o nome do evento.',
      issueEventDate: 'Informe a data do evento.',
      issueStartTime: 'Informe o horário de início.',
      issueEndTime: 'Informe o horário de término.',
      issueAddress: 'Informe o endereço.',
      issueCity: 'Informe a cidade.',
      issueState: 'Informe o estado.',
      issueZip: 'Informe um CEP brasileiro (ex.: 01310-100) ou ZIP dos EUA.',
      issueAdults: 'Informe o número de adultos (mínimo 1).',
      issueSelectPackage: 'Selecione um pacote.',
      issueNoAdditionals: 'Nenhum adicional selecionado (opcional).',
      issueHasGrill: 'Informe se o cliente possui churrasqueira.',
      issueGrillQty: 'Informe a quantidade de churrasqueiras para aluguel.',
      issueBase: 'Base deve ser {base}.',
      issueDistance: 'Informe a distância (mi).',
      issueFreeLimit: 'Limite gratuito deve ser {limit} mi.',
      issueRate: 'Taxa deve ser ${rate}/mi.',
      issueReservationPct: 'Reserva deve ser {pct}%.',
      issueReservationAmount: 'Calcule o valor da reserva.',
      issueIncompleteSteps: 'Existem etapas obrigatórias incompletas.',
      grillPhotoPendingWarning:
        'Foto da churrasqueira pendente. Pode ser confirmada posteriormente.',
      noPackages: 'Nenhum pacote disponível.',
      withSides: 'Com guarnições',
      withoutSides: 'Sem guarnições',
      packageValue: 'Valor do pacote',
      totalPerPerson: 'Total por pessoa',
      garnish: 'Guarnições',
      highlight: 'Destaque',
      highlights: 'Destaques',
      includedItems: 'Itens inclusos',
      packageHighlights: 'Destaques do pacote',
      meatsCategory: 'Carnes',
      sausagesCategory: 'Linguiças',
      packageItemsCategory: 'Itens do pacote',
      condimentsCategory: 'Condimentos internos',
      customPackageHint: 'Pacote personalizado — itens definidos na cotação.',
      itemsConfiguring: 'Itens do pacote em configuração.',
      includedSides: 'Guarnições inclusas',
      price: 'Preço',
      packageImage: 'Imagem do pacote',
      packageImageMissing: 'Imagem do pacote não cadastrada',
      packageSummary: 'Resumo do pacote',
      packagePriceLabel: 'Preço do pacote',
      garnishPriceLabel: 'Preço da guarnição',
      garnishIncluded: 'inclusas',
      total: 'Total',
      required: 'obrigatório',
      chooseOption: 'Escolha uma opção para continuar.',
      optionsUnavailable: 'Opções indisponíveis.',
      includedChoices: 'Escolhas inclusas:',
      packageItems: 'Itens do pacote:',
      additionalItems: 'Itens adicionais:',
      none: 'Nenhum',
      notIncluded: 'Não inclusas',
      billedPeople: 'Pessoas cobradas',
      basePackageValue: 'Valor pacote base',
      garnishValue: 'Valor guarnições',
      packageTotal: 'Total pacote',
      extrasOnQuote: 'Extras na cotação',
      minOrderAdjustment: 'Ajuste para pedido mínimo',
      reservationDeposit: 'Reserva (sinal)',
      grillToRent: 'Churrasqueira para alugar',
      additionalCount: '{count} adicional{plural}',
      preview: 'Prévia',
      beforeSave: 'Antes de salvar',
      draft: 'Rascunho',
      reservationPctLabel: 'Percentual de reserva',
      reservationAmountLabel: 'Valor da reserva',
      minOrderAppliedNote:
        'Pedido mínimo aplicado: o total foi elevado para atingir o mínimo comercial da data do evento.',
      holidaySurchargeNote:
        'Adicional de feriado / data comemorativa: acréscimo de 100% aplicado sobre o subtotal (pacote + adicionais + milhagem) — feriados federais dos EUA e datas 24, 25 e 31/dez e 1º de janeiro.',
      reservationBalanceLine: 'Reserva: {reservation}% · Saldo: {balance}%',
      quoteProgress: 'Progresso da cotação',
      stepsCompleted: '{done} de {total} etapas concluídas',
      completionPercent: '{pct}% de conclusão',
      readyToGenerate: 'Pronto para gerar cotação',
      missingMandatory: 'Faltam {count} etapas obrigatórias',
      pendingTitle: 'Pendências da cotação',
      quoteReadyToSave: 'Cotação pronta para salvar e gerar PDF.',
      goToStep: 'Ir para etapa',
      warningPrefix: 'Aviso — {label}',
      saveFailed: 'Não foi possível salvar a cotação.',
      createFailed: 'Não foi possível criar a cotação.',
      technicalError: 'Erro técnico',
      rawError: 'Erro bruto (raw)',
      commercialAdjustment: 'Ajuste comercial aplicado',
      subtotalLine: 'Subtotal (pacote + adicionais + milhagem)',
      minOrderRaised:
        'Pedido mínimo aplicado (mín. {min}): o total foi elevado em {amount} para cumprir a regra da data do evento.',
      guestRule:
        'Regra CDL: crianças até 3 anos não pagam; de 4 a 12 anos pagam meia; adultos pagam valor cheio. Pessoas cobradas equivalentes = adultos + (crianças 4–12 × 0,5).',
      fetchErrorCustomers: 'Clientes',
      fetchErrorPackages: 'Pacotes',
      fetchErrorCatalog: 'Catálogo de itens',
      fetchErrorPackageConfig: 'Configuração do pacote',
      fetchErrorEmptyPackages:
        'Pacotes: nenhum pacote ativo encontrado para a empresa.',
      fetchErrorQuote: 'Cotação',
      fetchErrorEvent: 'Evento',
      fetchErrorLinkedPackage: 'Pacote vinculado',
      fetchErrorQuoteAdditionals: 'Adicionais da cotação',
      fetchErrorPackageSelections: 'Escolhas do pacote',
      loadQuoteError: 'Erro ao carregar cotação',
      quoteNotFound: 'Cotação não encontrada.',
      pdfFailed: 'Não foi possível gerar o PDF.',
      pdfDownloadError: 'Erro ao baixar PDF.',
      generatingPdf: 'Gerando PDF…',
      downloadPdf: 'Baixar PDF',
      quoteCreated: 'Cotação criada com sucesso.',
      quoteUpdated: 'Cotação atualizada com sucesso.',
      details: 'Detalhes',
      lessDetails: 'Menos detalhes',
      billed: 'Cobradas',
      miles: 'Milhas',
      mileageFeeShort: 'Taxa milhagem',
      additionalShort: 'Adicional',
      grillShort: 'Churrasqueira',
      photoShort: 'Foto',
      printTitle: 'Proposta BBQ At Home',
      photoUpdating: 'Foto em atualização',
      finalChoice: 'Escolha final',
      includedSidesColon: 'Guarnições inclusas:',
      listAnd: 'e',
      listOr: 'ou',
      optionFallback: 'Opção',
      seafoodOption: 'Frutos do mar',
      ribOption: 'Costela',
      sideOption: 'Guarnição',
      comingSoon: 'Em breve',
      refresh: 'Atualizar',
      refreshing: 'Atualizando…',
      physicalGuests: 'Convidados físicos',
      billableGuests: 'Pessoas cobradas',
      totalToPay: 'TOTAL DA COTAÇÃO',
      reservationRuleHint:
        'O sinal reserva a data. O saldo restante é pago no evento.',
      pricingCalculating: 'Calculando valores...',
      pricingCalcError: 'Não foi possível calcular a cotação.',
      breakdownPackage: 'Pacote',
      breakdownAdditional: 'Adicionais',
      breakdownMileage: 'Milhagem',
      breakdownGrillRental: 'Aluguel de churrasqueira',
      breakdownHoliday: 'Acréscimo feriado',
      breakdownMinimum: 'Pedido mínimo',
      breakdownDiscount: 'Desconto',
      breakdownSubtotal: 'Subtotal',
      breakdownDeposit: 'Sinal',
      breakdownBalance: 'Saldo',
      breakdownDepositPct: '{pct}% configurado nas regras comerciais',
      confirmSectionClient: 'Cliente',
      confirmSectionEvent: 'Evento',
      confirmSectionGuests: 'Convidados',
      confirmSectionPackage: 'Pacote',
      confirmSectionAdditionals: 'Adicionais',
      confirmSectionGrill: 'Churrasqueira',
      confirmSectionMileage: 'Milhagem / deslocamento',
      confirmSectionFinancial: 'Financeiro',
      confirmSectionRules: 'Regras comerciais',
      confirmSectionCancellation: 'Política de cancelamento',
      categoriesReviewRequired:
        'Revise todas as categorias antes de continuar. Faltam {remaining} de {total}.',
      categoriesReviewComplete:
        'Todas as categorias foram revisadas. Você pode continuar.',
      categoriesReviewPendingHeading: 'Categorias pendentes',
      categoryReviewStatusReviewed: 'Revisada',
      categoryReviewStatusPending: 'Pendente',
      grillPhotoRequiredError: 'Adicione uma foto da churrasqueira para continuar.',
      grillPendingPhoto: 'Adicione uma foto da churrasqueira para continuar.',
      grillPendingRentalQty:
        'Informe uma quantidade válida para a locação da churrasqueira.',
      stepPendingTitle: 'Pendências desta etapa',
      packagesLoadError: 'Erro ao carregar pacotes. Tente atualizar a página.',
      mileageOrigin: 'Origem',
      mileageDestination: 'Destino',
      mileageTotalDistance: 'Distância considerada',
      mileageIncluded: 'Milhas incluídas',
      mileageChargeable: 'Milhas cobradas',
      mileageRateLabel: 'Tarifa',
      mileageFormula: 'Cálculo',
      mileageFeeFinal: 'Valor da milhagem',
      grillAtLocation: 'Churrasqueira no local',
      grillRentalValue: 'Valor do aluguel',
      editStep: 'Editar',
      financialTotal: 'Total a pagar',
      additionalValue: 'Valor adicional',
      mileageValue: 'Valor milhagem',
      importantRules: 'Regras importantes',
      cancellationPolicy: 'Política de cancelamento',
      extrasCount: '{count} adicional{plural}',
      mileagePendingReview:
        'Deslocamento pendente de revisão. A equipe confirma o valor final antes da aprovação.',
      privacyLink: 'Privacidade',
      publicSubmitRequest: 'Enviar solicitação',
      publicSubmittingRequest: 'Enviando com segurança…',
      consentRequired: 'Aceite o consentimento para enviar.',
      publicSubmitError:
        'Não foi possível enviar agora. Revise os dados e tente novamente.',
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
      3: 'Add extra items if you want. Selection is optional.',
      4: 'Configure grill, photo and rental when applicable.',
      5: 'Review and confirm the full commercial quote.',
    },
    wizardSteps: [
      'Customer',
      'Event',
      'Package',
      'Extras',
      'BBQ',
      'Confirmation',
    ],
    wizardStepsShort: [
      'Client',
      'Event',
      'Pack',
      'Extras',
      'BBQ',
      'Review',
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
    wizard: {
      langPt: 'Português (PT)',
      langEn: 'English (EN)',
      langEs: 'Español (ES)',
      selectDate: 'Select the date',
      selectTime: 'Select the time',
      prevMonth: 'Previous month',
      nextMonth: 'Next month',
      calendarOf: '{label} calendar',
      timePickerOf: '{label} picker',
      hour: 'Hour',
      minutes: 'Minutes',
      customerPhone: 'Customer phone',
      customerName: 'Customer name',
      customerEmail: 'Email',
      contactNamePlaceholder: 'Contact name',
      searchExistingCustomer: 'Search existing customer',
      searchCustomerPlaceholder: 'Type name, phone, email or AB number',
      customersFound: 'Customers found',
      searching: 'Searching…',
      noCustomersFound: 'No customers found.',
      searchHint:
        'Type to search the address book — results appear below the field.',
      linkingCustomer: 'Looking up or creating the customer by phone…',
      customerLinked: 'Customer linked',
      refreshCustomersError: 'Could not refresh customers.',
      refreshCustomersListError: 'Error refreshing the customer list.',
      linkedCustomerNotFound: 'Linked customer not found',
      lookupByPhoneError: 'Could not look up the customer by phone.',
      existingCustomerLinked: 'Existing customer linked.',
      newCustomerDraft:
        'New customer — will be registered when the quote is saved.',
      networkLookupError: 'Network error looking up the customer.',
      eventName: 'Event name',
      eventNamePlaceholder: 'Event name',
      eventDate: 'Event date',
      startTime: 'Start time',
      endTime: 'End time',
      endTimeHint: 'Filled automatically with +4h. You can change it if needed.',
      endTimeHintPublic:
        'Calculated automatically from the start time. This field cannot be edited.',
      publicPhoneHint:
        'Start with the country code. United States is +1; for another country use its code, for example +55.',
      publicPhonePlaceholder: 'e.g. +1 407 555 0123',
      firstName: 'First name',
      lastName: 'Last name',
      contactPrivacyHint:
        'We use these details only to prepare and follow up on your event request.',
      publicPackageOptionsTitle: 'Options for this package',
      publicPackageChooseHint:
        'Tap a package to select it. Then complete only the required options.',
      pricingRetry: 'Try again',
      pricingTimeout: 'The estimate took too long. Please try again.',
      pricingRateLimited:
        'Too many estimate attempts. Wait a moment and try again.',
      pricingMissingPackage: 'Select a package to calculate the estimate.',
      chargeUnitPerPerson: 'per person',
      chargeUnitPerUnit: 'per unit',
      chargeUnitPerPortion: 'per portion',
      chargeUnitFixed: 'fixed price',
      priceUnavailable: 'Price to confirm',
      mileageDistanceMiKm: '{mi} mi ({km} km)',
      mileageRuleLabel: 'Applied rule',
      mileageRuleSummary:
        'Up to {included} mi included. Above that, {rate} per mile.',
      adults: 'Adults',
      childrenUnder3: 'Children up to 3 years',
      children4to12: 'Children 4 to 12 years',
      hasGrill: 'Does the customer have a grill?',
      grillPhotoReceived: 'Grill photo received?',
      yes: 'Yes',
      no: 'No',
      notApplicable: 'Not applicable',
      pending: 'Pending',
      photoConfirmed: 'Photo confirmed as received.',
      photoPendingHint: 'Photo still pending validation.',
      attachGrillPhoto: 'Attach grill photo',
      grillPhotoHint:
        'If the customer has their own grill, confirm the photo was received to validate size, condition and structure before the event.',
      grillRentalRequired: 'Grill rental required?',
      grillRentalQty: 'Number of grills to rent',
      grillNotes: 'Grill notes',
      grillNotesPlaceholder:
        'E.g.: customer has a grill, but photo is still pending',
      mileageBaseHint:
        'Current base: {base}. Up to {limit} mi free. Above {limit} mi, apply the configured commercial rule.',
      baseLocation: 'Base location',
      baseLocationPlaceholder: 'Base location',
      distanceMi: 'Distance (mi)',
      freeLimitMi: 'Free limit (mi)',
      ratePerMi: 'Rate ($/mi)',
      mileageSummary: 'Mileage summary',
      totalMiles: 'Total miles',
      includedMiles: 'Included miles',
      chargedMiles: 'Charged miles',
      calculatedFee: 'Calculated fee',
      quoteTotal: 'Quote total',
      reservationPct: 'Deposit percentage (%)',
      reservationAmount: 'Deposit amount ($)',
      reservationRecalcHint:
        'Percentage with up to 3 decimal places or absolute $ amount — the other field is recalculated automatically. Deposit: {summary} · Balance: {balance}',
      reservationNotesPlaceholder: 'Deposit notes...',
      notes: 'Notes',
      customerNotLinkedShort: 'Customer not linked yet',
      pendingPreviousSteps: 'There are required pending items in previous steps.',
      packageNotSelected: 'Package not selected.',
      packageNotInCatalog: 'Selected package was not found in the catalog.',
      quoteNotCreated: 'Quote was not created — response without a Supabase id.',
      selectPackageToContinue: 'Select a package to continue.',
      nextCompleteOptions: 'Next — complete the required options',
      googleSearchLabel: 'Search address on Google',
      googleSearchPlaceholder: 'Type the address to autocomplete...',
      googleLoading: 'Loading Google Places...',
      googleLoadError: 'Could not load Google Places.',
      googleApiKeyMissing:
        'Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to search on Google.',
      addressPlaceholder: 'Address',
      addressSelectionRequired:
        'Type the street and select a Google suggestion to validate the route.',
      addressZipMismatch:
        'Select an address that belongs to the entered ZIP/postal code.',
      cityPlaceholder: 'City',
      statePlaceholder: 'State',
      zipPlaceholder: '32801',
      issueEventName: 'Enter the event name.',
      issueEventDate: 'Enter the event date.',
      issueStartTime: 'Enter the start time.',
      issueEndTime: 'Enter the end time.',
      issueAddress: 'Enter the address.',
      issueCity: 'Enter the city.',
      issueState: 'Enter the state.',
      issueZip: 'Enter a Brazilian ZIP (e.g. 01310-100) or a US ZIP code.',
      issueAdults: 'Enter the number of adults (minimum 1).',
      issueSelectPackage: 'Select a package.',
      issueNoAdditionals: 'No extras selected (optional).',
      issueHasGrill: 'Indicate whether the customer has a grill.',
      issueGrillQty: 'Enter the number of grills to rent.',
      issueBase: 'Base must be {base}.',
      issueDistance: 'Enter the distance (mi).',
      issueFreeLimit: 'Free limit must be {limit} mi.',
      issueRate: 'Rate must be ${rate}/mi.',
      issueReservationPct: 'Deposit must be {pct}%.',
      issueReservationAmount: 'Calculate the deposit amount.',
      issueIncompleteSteps: 'There are incomplete required steps.',
      grillPhotoPendingWarning:
        'Grill photo pending. It can be confirmed later.',
      noPackages: 'No packages available.',
      withSides: 'With sides',
      withoutSides: 'Without sides',
      packageValue: 'Package value',
      totalPerPerson: 'Total per person',
      garnish: 'Sides',
      highlight: 'Highlight',
      highlights: 'Highlights',
      includedItems: 'Included items',
      packageHighlights: 'Package highlights',
      meatsCategory: 'Meats',
      sausagesCategory: 'Sausages',
      packageItemsCategory: 'Package items',
      condimentsCategory: 'Internal condiments',
      customPackageHint: 'Custom package — items defined on the quote.',
      itemsConfiguring: 'Package items are being configured.',
      includedSides: 'Included sides',
      price: 'Price',
      packageImage: 'Package image',
      packageImageMissing: 'Package image not registered',
      packageSummary: 'Package summary',
      packagePriceLabel: 'Package price',
      garnishPriceLabel: 'Sides price',
      garnishIncluded: 'included',
      total: 'Total',
      required: 'required',
      chooseOption: 'Choose an option to continue.',
      optionsUnavailable: 'Options unavailable.',
      includedChoices: 'Included choices:',
      packageItems: 'Package items:',
      additionalItems: 'Extra items:',
      none: 'None',
      notIncluded: 'Not included',
      billedPeople: 'Billable guests',
      basePackageValue: 'Base package value',
      garnishValue: 'Sides value',
      packageTotal: 'Package total',
      extrasOnQuote: 'Quote extras',
      minOrderAdjustment: 'Minimum-order adjustment',
      reservationDeposit: 'Deposit',
      grillToRent: 'Grill to rent',
      additionalCount: '{count} extra{plural}',
      preview: 'Preview',
      beforeSave: 'Before saving',
      draft: 'Draft',
      reservationPctLabel: 'Deposit percentage',
      reservationAmountLabel: 'Deposit amount',
      minOrderAppliedNote:
        'Minimum order applied: the total was raised to meet the commercial minimum for the event date.',
      holidaySurchargeNote:
        'US holiday / commemorative surcharge: 100% applied on the subtotal (package + extras + mileage) — US federal holidays and Dec 24, 25, 31 and Jan 1.',
      reservationBalanceLine: 'Deposit: {reservation}% · Balance: {balance}%',
      quoteProgress: 'Quote progress',
      stepsCompleted: '{done} of {total} steps completed',
      completionPercent: '{pct}% complete',
      readyToGenerate: 'Ready to generate quote',
      missingMandatory: '{count} required steps remaining',
      pendingTitle: 'Quote pending items',
      quoteReadyToSave: 'Quote ready to save and generate PDF.',
      goToStep: 'Go to step',
      warningPrefix: 'Warning — {label}',
      saveFailed: 'Could not save the quote.',
      createFailed: 'Could not create the quote.',
      technicalError: 'Technical error',
      rawError: 'Raw error',
      commercialAdjustment: 'Commercial adjustment applied',
      subtotalLine: 'Subtotal (package + extras + mileage)',
      minOrderRaised:
        'Minimum order applied (min. {min}): the total was raised by {amount} to meet the event-date rule.',
      guestRule:
        'CDL rule: children up to 3 years are free; ages 4 to 12 pay half; adults pay full price. Billable equivalent guests = adults + (children 4–12 × 0.5).',
      fetchErrorCustomers: 'Customers',
      fetchErrorPackages: 'Packages',
      fetchErrorCatalog: 'Item catalog',
      fetchErrorPackageConfig: 'Package configuration',
      fetchErrorEmptyPackages:
        'Packages: no active package found for the company.',
      fetchErrorQuote: 'Quote',
      fetchErrorEvent: 'Event',
      fetchErrorLinkedPackage: 'Linked package',
      fetchErrorQuoteAdditionals: 'Quote extras',
      fetchErrorPackageSelections: 'Package choices',
      loadQuoteError: 'Error loading quote',
      quoteNotFound: 'Quote not found.',
      pdfFailed: 'Could not generate the PDF.',
      pdfDownloadError: 'Error downloading PDF.',
      generatingPdf: 'Generating PDF…',
      downloadPdf: 'Download PDF',
      quoteCreated: 'Quote created successfully.',
      quoteUpdated: 'Quote updated successfully.',
      details: 'Details',
      lessDetails: 'Fewer details',
      billed: 'Billable',
      miles: 'Miles',
      mileageFeeShort: 'Mileage fee',
      additionalShort: 'Extra',
      grillShort: 'Grill',
      photoShort: 'Photo',
      printTitle: 'BBQ At Home proposal',
      photoUpdating: 'Photo updating',
      finalChoice: 'Final choice',
      includedSidesColon: 'Included sides:',
      listAnd: 'and',
      listOr: 'or',
      optionFallback: 'Option',
      seafoodOption: 'Seafood',
      ribOption: 'Ribs',
      sideOption: 'Side',
      comingSoon: 'Coming soon',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      physicalGuests: 'Physical guests',
      billableGuests: 'Billable guests',
      totalToPay: 'QUOTE TOTAL',
      reservationRuleHint:
        'The deposit reserves the date. The remaining balance is due at the event.',
      pricingCalculating: 'Calculating pricing...',
      pricingCalcError: 'Could not calculate the quote.',
      breakdownPackage: 'Package',
      breakdownAdditional: 'Additional items',
      breakdownMileage: 'Mileage',
      breakdownGrillRental: 'Grill rental',
      breakdownHoliday: 'Holiday surcharge',
      breakdownMinimum: 'Minimum order',
      breakdownDiscount: 'Discount',
      breakdownSubtotal: 'Subtotal',
      breakdownDeposit: 'Deposit',
      breakdownBalance: 'Balance',
      breakdownDepositPct: '{pct}% per commercial rules',
      confirmSectionClient: 'Customer',
      confirmSectionEvent: 'Event',
      confirmSectionGuests: 'Guests',
      confirmSectionPackage: 'Package',
      confirmSectionAdditionals: 'Additional items',
      confirmSectionGrill: 'Grill setup',
      confirmSectionMileage: 'Mileage / travel',
      confirmSectionFinancial: 'Financial summary',
      confirmSectionRules: 'Commercial rules',
      confirmSectionCancellation: 'Cancellation policy',
      categoriesReviewRequired:
        'Review all categories before continuing. {remaining} of {total} remaining.',
      categoriesReviewComplete:
        'All categories have been reviewed. You can continue.',
      categoriesReviewPendingHeading: 'Pending categories',
      categoryReviewStatusReviewed: 'Reviewed',
      categoryReviewStatusPending: 'Pending',
      grillPhotoRequiredError: 'Add a photo of the grill to continue.',
      grillPendingPhoto: 'Add a photo of the grill to continue.',
      grillPendingRentalQty: 'Enter a valid grill rental quantity.',
      stepPendingTitle: 'Pending items for this step',
      packagesLoadError: 'Failed to load packages. Try refreshing the page.',
      mileageOrigin: 'Origin',
      mileageDestination: 'Destination',
      mileageTotalDistance: 'Distance considered',
      mileageIncluded: 'Included miles',
      mileageChargeable: 'Chargeable miles',
      mileageRateLabel: 'Rate',
      mileageFormula: 'Calculation',
      mileageFeeFinal: 'Mileage amount',
      grillAtLocation: 'Grill at the venue',
      grillRentalValue: 'Rental amount',
      editStep: 'Edit',
      financialTotal: 'Total due',
      additionalValue: 'Additional value',
      mileageValue: 'Mileage value',
      importantRules: 'Important rules',
      cancellationPolicy: 'Cancellation policy',
      extrasCount: '{count} extra{plural}',
      mileagePendingReview:
        'Travel is pending review. The team confirms the final amount before approval.',
      privacyLink: 'Privacy',
      publicSubmitRequest: 'Send request',
      publicSubmittingRequest: 'Sending securely…',
      consentRequired: 'Accept the consent to submit.',
      publicSubmitError:
        'We could not submit right now. Review the details and try again.',
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
      3: 'Agregue ítems extra si quiere. La selección es opcional.',
      4: 'Configure parrilla, foto y rental cuando aplique.',
      5: 'Revise y confirme la cotización comercial completa.',
    },
    wizardSteps: [
      'Cliente',
      'Evento',
      'Paquete',
      'Adicionales',
      'Parrilla',
      'Confirmación',
    ],
    wizardStepsShort: [
      'Cliente',
      'Evento',
      'Pack',
      'Extra',
      'BBQ',
      'Revisión',
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
    wizard: {
      langPt: 'Português (PT)',
      langEn: 'English (EN)',
      langEs: 'Español (ES)',
      selectDate: 'Seleccione la fecha',
      selectTime: 'Seleccione el horario',
      prevMonth: 'Mes anterior',
      nextMonth: 'Próximo mes',
      calendarOf: 'Calendario de {label}',
      timePickerOf: 'Selector de {label}',
      hour: 'Hora',
      minutes: 'Minutos',
      customerPhone: 'Teléfono del cliente',
      customerName: 'Nombre del cliente',
      customerEmail: 'Correo',
      contactNamePlaceholder: 'Nombre de contacto',
      searchExistingCustomer: 'Buscar cliente existente',
      searchCustomerPlaceholder: 'Escriba nombre, teléfono, correo o AB number',
      customersFound: 'Clientes encontrados',
      searching: 'Buscando…',
      noCustomersFound: 'Ningún cliente encontrado.',
      searchHint:
        'Escriba para buscar en el registro — la lista aparece debajo del campo.',
      linkingCustomer: 'Buscando o creando el cliente por teléfono…',
      customerLinked: 'Cliente vinculado',
      refreshCustomersError: 'No fue posible actualizar clientes.',
      refreshCustomersListError: 'Error al actualizar la lista de clientes.',
      linkedCustomerNotFound: 'Cliente vinculado no encontrado',
      lookupByPhoneError: 'No fue posible buscar el cliente por teléfono.',
      existingCustomerLinked: 'Cliente existente vinculado.',
      newCustomerDraft:
        'Nuevo cliente — se registrará al finalizar la cotización.',
      networkLookupError: 'Error de red al buscar el cliente.',
      eventName: 'Nombre del evento',
      eventNamePlaceholder: 'Nombre del evento',
      eventDate: 'Fecha del evento',
      startTime: 'Horario de inicio',
      endTime: 'Horario de fin',
      endTimeHint:
        'Completado automáticamente con +4h. Puede cambiarlo si desea.',
      endTimeHintPublic:
        'Calculado automáticamente a partir del horario de inicio. No se puede editar.',
      publicPhoneHint:
        'Empiece por el código del país. Estados Unidos es +1; para otro país use su código, por ejemplo +55.',
      publicPhonePlaceholder: 'Ej.: +1 407 555 0123',
      firstName: 'Nombre',
      lastName: 'Apellido',
      contactPrivacyHint:
        'Usamos estos datos solo para preparar y dar seguimiento a tu solicitud.',
      publicPackageOptionsTitle: 'Opciones de este paquete',
      publicPackageChooseHint:
        'Toque el paquete para seleccionarlo. Luego complete solo las opciones obligatorias.',
      pricingRetry: 'Intentar de nuevo',
      pricingTimeout: 'La estimación tardó demasiado. Inténtelo de nuevo.',
      pricingRateLimited:
        'Demasiados intentos de cálculo. Espere un momento e inténtelo de nuevo.',
      pricingMissingPackage: 'Seleccione un paquete para calcular la estimación.',
      chargeUnitPerPerson: 'por persona',
      chargeUnitPerUnit: 'por unidad',
      chargeUnitPerPortion: 'por porción',
      chargeUnitFixed: 'precio fijo',
      priceUnavailable: 'Precio por confirmar',
      mileageDistanceMiKm: '{mi} mi ({km} km)',
      mileageRuleLabel: 'Regla aplicada',
      mileageRuleSummary:
        'Hasta {included} mi incluidas. Por encima, {rate} por milla.',
      adults: 'Adultos',
      childrenUnder3: 'Niños hasta 3 años',
      children4to12: 'Niños de 4 a 12 años',
      hasGrill: '¿El cliente tiene parrilla?',
      grillPhotoReceived: '¿Foto de la parrilla recibida?',
      yes: 'Sí',
      no: 'No',
      notApplicable: 'No aplica',
      pending: 'Pendiente',
      photoConfirmed: 'Foto confirmada como recibida.',
      photoPendingHint: 'Foto aún pendiente de validación.',
      attachGrillPhoto: 'Adjuntar foto de la parrilla',
      grillPhotoHint:
        'Si el cliente tiene parrilla propia, confirme si la foto fue recibida para validar tamaño, condición y estructura antes del evento.',
      grillRentalRequired: '¿Necesita alquilar parrilla?',
      grillRentalQty: 'Cantidad de parrillas para alquiler',
      grillNotes: 'Observaciones sobre la parrilla',
      grillNotesPlaceholder:
        'Ej.: el cliente tiene parrilla, pero la foto aún está pendiente',
      mileageBaseHint:
        'Base actual: {base}. Hasta {limit} mi gratis. Por encima de {limit} mi, aplicar la regla comercial configurada.',
      baseLocation: 'Ubicación base',
      baseLocationPlaceholder: 'Ubicación base',
      distanceMi: 'Distancia (mi)',
      freeLimitMi: 'Límite gratuito (mi)',
      ratePerMi: 'Tarifa ($/mi)',
      mileageSummary: 'Resumen de kilometraje',
      totalMiles: 'Millas totales',
      includedMiles: 'Millas incluidas',
      chargedMiles: 'Millas cobradas',
      calculatedFee: 'Tarifa calculada',
      quoteTotal: 'Total de la cotización',
      reservationPct: 'Porcentaje de reserva (%)',
      reservationAmount: 'Importe de la reserva ($)',
      reservationRecalcHint:
        'Porcentaje con hasta 3 decimales o importe absoluto en $ — el otro campo se recalcula automáticamente. Reserva: {summary} · Saldo: {balance}',
      reservationNotesPlaceholder: 'Observaciones de la reserva...',
      notes: 'Observaciones',
      customerNotLinkedShort: 'Cliente aún no vinculado',
      pendingPreviousSteps:
        'Hay pendientes obligatorios en las etapas anteriores.',
      packageNotSelected: 'Paquete no seleccionado.',
      packageNotInCatalog: 'El paquete seleccionado no está en el catálogo.',
      quoteNotCreated: 'La cotización no se creó — respuesta sin id de Supabase.',
      selectPackageToContinue: 'Seleccione un paquete para continuar.',
      nextCompleteOptions: 'Siguiente — complete las opciones obligatorias',
      googleSearchLabel: 'Buscar dirección en Google',
      googleSearchPlaceholder: 'Escriba la dirección para autocompletar...',
      googleLoading: 'Cargando Google Places...',
      googleLoadError: 'No fue posible cargar Google Places.',
      googleApiKeyMissing:
        'Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para buscar en Google.',
      addressPlaceholder: 'Dirección',
      addressSelectionRequired:
        'Escriba la calle y seleccione una sugerencia de Google para validar la ruta.',
      addressZipMismatch:
        'Seleccione una dirección que pertenezca al código postal indicado.',
      cityPlaceholder: 'Ciudad',
      statePlaceholder: 'Estado',
      zipPlaceholder: '01310-100',
      issueEventName: 'Indique el nombre del evento.',
      issueEventDate: 'Indique la fecha del evento.',
      issueStartTime: 'Indique el horario de inicio.',
      issueEndTime: 'Indique el horario de término.',
      issueAddress: 'Indique la dirección.',
      issueCity: 'Indique la ciudad.',
      issueState: 'Indique el estado.',
      issueZip: 'Indique un CEP de Brasil (ej.: 01310-100) o ZIP de EE. UU.',
      issueAdults: 'Indique el número de adultos (mínimo 1).',
      issueSelectPackage: 'Seleccione un paquete.',
      issueNoAdditionals: 'Ningún adicional seleccionado (opcional).',
      issueHasGrill: 'Indique si el cliente tiene parrilla.',
      issueGrillQty: 'Indique la cantidad de parrillas para alquiler.',
      issueBase: 'La base debe ser {base}.',
      issueDistance: 'Indique la distancia (mi).',
      issueFreeLimit: 'El límite gratuito debe ser {limit} mi.',
      issueRate: 'La tarifa debe ser ${rate}/mi.',
      issueReservationPct: 'La reserva debe ser {pct}%.',
      issueReservationAmount: 'Calcule el importe de la reserva.',
      issueIncompleteSteps: 'Hay etapas obligatorias incompletas.',
      grillPhotoPendingWarning:
        'Foto de la parrilla pendiente. Puede confirmarse más adelante.',
      noPackages: 'Ningún paquete disponible.',
      withSides: 'Con guarniciones',
      withoutSides: 'Sin guarniciones',
      packageValue: 'Valor del paquete',
      totalPerPerson: 'Total por persona',
      garnish: 'Guarniciones',
      highlight: 'Destacado',
      highlights: 'Destacados',
      includedItems: 'Ítems incluidos',
      packageHighlights: 'Destacados del paquete',
      meatsCategory: 'Carnes',
      sausagesCategory: 'Embutidos',
      packageItemsCategory: 'Ítems del paquete',
      condimentsCategory: 'Condimentos internos',
      customPackageHint: 'Paquete personalizado — ítems definidos en la cotización.',
      itemsConfiguring: 'Ítems del paquete en configuración.',
      includedSides: 'Guarniciones incluidas',
      price: 'Precio',
      packageImage: 'Imagen del paquete',
      packageImageMissing: 'Imagen del paquete no registrada',
      packageSummary: 'Resumen del paquete',
      packagePriceLabel: 'Precio del paquete',
      garnishPriceLabel: 'Precio de la guarnición',
      garnishIncluded: 'incluidas',
      total: 'Total',
      required: 'obligatorio',
      chooseOption: 'Elija una opción para continuar.',
      optionsUnavailable: 'Opciones no disponibles.',
      includedChoices: 'Elecciones incluidas:',
      packageItems: 'Ítems del paquete:',
      additionalItems: 'Ítems adicionales:',
      none: 'Ninguno',
      notIncluded: 'No incluidas',
      billedPeople: 'Personas facturables',
      basePackageValue: 'Valor del paquete base',
      garnishValue: 'Valor de guarniciones',
      packageTotal: 'Total del paquete',
      extrasOnQuote: 'Extras en la cotización',
      minOrderAdjustment: 'Ajuste por pedido mínimo',
      reservationDeposit: 'Reserva (señal)',
      grillToRent: 'Parrilla para alquilar',
      additionalCount: '{count} adicional{plural}',
      preview: 'Vista previa',
      beforeSave: 'Antes de guardar',
      draft: 'Borrador',
      reservationPctLabel: 'Porcentaje de reserva',
      reservationAmountLabel: 'Importe de la reserva',
      minOrderAppliedNote:
        'Pedido mínimo aplicado: el total se elevó para alcanzar el mínimo comercial de la fecha del evento.',
      holidaySurchargeNote:
        'Adicional de feriado / fecha conmemorativa: recargo del 100% aplicado sobre el subtotal (paquete + adicionales + kilometraje) — feriados federales de EE. UU. y fechas 24, 25 y 31/dic y 1 de enero.',
      reservationBalanceLine: 'Reserva: {reservation}% · Saldo: {balance}%',
      quoteProgress: 'Progreso de la cotización',
      stepsCompleted: '{done} de {total} etapas completadas',
      completionPercent: '{pct}% de conclusión',
      readyToGenerate: 'Lista para generar cotización',
      missingMandatory: 'Faltan {count} etapas obligatorias',
      pendingTitle: 'Pendientes de la cotización',
      quoteReadyToSave: 'Cotización lista para guardar y generar PDF.',
      goToStep: 'Ir a la etapa',
      warningPrefix: 'Aviso — {label}',
      saveFailed: 'No fue posible guardar la cotización.',
      createFailed: 'No fue posible crear la cotización.',
      technicalError: 'Error técnico',
      rawError: 'Error bruto (raw)',
      commercialAdjustment: 'Ajuste comercial aplicado',
      subtotalLine: 'Subtotal (paquete + adicionales + kilometraje)',
      minOrderRaised:
        'Pedido mínimo aplicado (mín. {min}): el total se elevó en {amount} para cumplir la regla de la fecha del evento.',
      guestRule:
        'Regla CDL: niños hasta 3 años no pagan; de 4 a 12 años pagan mitad; adultos pagan valor completo. Personas facturables equivalentes = adultos + (niños 4–12 × 0,5).',
      fetchErrorCustomers: 'Clientes',
      fetchErrorPackages: 'Paquetes',
      fetchErrorCatalog: 'Catálogo de ítems',
      fetchErrorPackageConfig: 'Configuración del paquete',
      fetchErrorEmptyPackages:
        'Paquetes: ningún paquete activo encontrado para la empresa.',
      fetchErrorQuote: 'Cotización',
      fetchErrorEvent: 'Evento',
      fetchErrorLinkedPackage: 'Paquete vinculado',
      fetchErrorQuoteAdditionals: 'Adicionales de la cotización',
      fetchErrorPackageSelections: 'Elecciones del paquete',
      loadQuoteError: 'Error al cargar la cotización',
      quoteNotFound: 'Cotización no encontrada.',
      pdfFailed: 'No fue posible generar el PDF.',
      pdfDownloadError: 'Error al descargar el PDF.',
      generatingPdf: 'Generando PDF…',
      downloadPdf: 'Descargar PDF',
      quoteCreated: 'Cotización creada con éxito.',
      quoteUpdated: 'Cotización actualizada con éxito.',
      details: 'Detalles',
      lessDetails: 'Menos detalles',
      billed: 'Facturables',
      miles: 'Millas',
      mileageFeeShort: 'Tarifa de kilometraje',
      additionalShort: 'Adicional',
      grillShort: 'Parrilla',
      photoShort: 'Foto',
      printTitle: 'Propuesta BBQ At Home',
      photoUpdating: 'Foto en actualización',
      finalChoice: 'Elección final',
      includedSidesColon: 'Guarniciones incluidas:',
      listAnd: 'y',
      listOr: 'o',
      optionFallback: 'Opción',
      seafoodOption: 'Mariscos',
      ribOption: 'Costilla',
      sideOption: 'Guarnición',
      comingSoon: 'Próximamente',
      refresh: 'Actualizar',
      refreshing: 'Actualizando…',
      physicalGuests: 'Invitados físicos',
      billableGuests: 'Personas cobradas',
      totalToPay: 'TOTAL DE LA COTIZACIÓN',
      reservationRuleHint:
        'La señal reserva la fecha. El saldo restante se paga en el evento.',
      pricingCalculating: 'Calculando valores...',
      pricingCalcError: 'No fue posible calcular la cotización.',
      breakdownPackage: 'Paquete',
      breakdownAdditional: 'Adicionales',
      breakdownMileage: 'Kilometraje',
      breakdownGrillRental: 'Alquiler de parrilla',
      breakdownHoliday: 'Recargo feriado',
      breakdownMinimum: 'Pedido mínimo',
      breakdownDiscount: 'Descuento',
      breakdownSubtotal: 'Subtotal',
      breakdownDeposit: 'Señal',
      breakdownBalance: 'Saldo',
      breakdownDepositPct: '{pct}% según reglas comerciales',
      confirmSectionClient: 'Cliente',
      confirmSectionEvent: 'Evento',
      confirmSectionGuests: 'Invitados',
      confirmSectionPackage: 'Paquete',
      confirmSectionAdditionals: 'Adicionales',
      confirmSectionGrill: 'Parrilla',
      confirmSectionMileage: 'Kilometraje / desplazamiento',
      confirmSectionFinancial: 'Financiero',
      confirmSectionRules: 'Reglas comerciales',
      confirmSectionCancellation: 'Política de cancelación',
      categoriesReviewRequired:
        'Revise todas las categorías antes de continuar. Faltan {remaining} de {total}.',
      categoriesReviewComplete:
        'Todas las categorías fueron revisadas. Puede continuar.',
      categoriesReviewPendingHeading: 'Categorías pendientes',
      categoryReviewStatusReviewed: 'Revisada',
      categoryReviewStatusPending: 'Pendiente',
      grillPhotoRequiredError: 'Agregue una foto de la parrilla para continuar.',
      grillPendingPhoto: 'Agregue una foto de la parrilla para continuar.',
      grillPendingRentalQty:
        'Ingrese una cantidad válida para el alquiler de la parrilla.',
      stepPendingTitle: 'Pendientes de esta etapa',
      packagesLoadError: 'Error al cargar paquetes. Intente actualizar la página.',
      mileageOrigin: 'Origen',
      mileageDestination: 'Destino',
      mileageTotalDistance: 'Distancia considerada',
      mileageIncluded: 'Millas incluidas',
      mileageChargeable: 'Millas cobradas',
      mileageRateLabel: 'Tarifa',
      mileageFormula: 'Cálculo',
      mileageFeeFinal: 'Valor del kilometraje',
      grillAtLocation: 'Parrilla en el lugar',
      grillRentalValue: 'Valor del alquiler',
      editStep: 'Editar',
      financialTotal: 'Total a pagar',
      additionalValue: 'Valor adicional',
      mileageValue: 'Valor de millaje',
      importantRules: 'Reglas importantes',
      cancellationPolicy: 'Política de cancelación',
      extrasCount: '{count} adicional{plural}',
      mileagePendingReview:
        'El desplazamiento está pendiente de revisión. El equipo confirma el valor final antes de la aprobación.',
      privacyLink: 'Privacidad',
      publicSubmitRequest: 'Enviar solicitud',
      publicSubmittingRequest: 'Enviando de forma segura…',
      consentRequired: 'Acepta el consentimiento para enviar.',
      publicSubmitError:
        'No pudimos enviar ahora. Revisa los datos e inténtalo de nuevo.',
    },
  },
}

export function getQuoteStrings(language: QuoteLanguage = 'pt'): QuoteStrings {
  return STRINGS[language] ?? STRINGS.pt
}

export function tw(
  language: QuoteLanguage | string | null | undefined,
  key: keyof QuoteStrings['wizard'],
  vars?: Record<string, string | number>,
): string {
  const loc: QuoteLanguage =
    language === 'en' || language === 'es' || language === 'pt' ? language : 'pt'
  const text = getQuoteStrings(loc).wizard[key]
  return vars ? fillTemplate(text, vars) : text
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
