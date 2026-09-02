import type { BrasinhaLanguage } from '../types'
import type { CatalogHit, PackageSummary, PublicRulesSnapshot } from '../tools/types'

function money(value: number | null, currency: string) {
  if (value == null || !Number.isFinite(value)) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(value)
}

export function packagesReply(
  language: BrasinhaLanguage,
  packages: PackageSummary[],
): string {
  const lines = packages
    .filter((pkg) => !pkg.custom)
    .map((pkg) => {
      const price = money(pkg.pricePerPerson, pkg.currency)
      return price ? `${pkg.label}: ${price}/person` : pkg.label
    })
  if (!lines.length) {
    return language === 'en'
      ? "I'll confirm the current package list with the CDL team so I don't pass along incorrect information."
      : language === 'es'
        ? 'Voy a confirmar la lista de paquetes con el equipo CDL para no pasarte una información incorrecta.'
        : 'Vou confirmar a lista de pacotes com a equipe CDL para não te passar uma informação incorreta.'
  }
  if (language === 'en') {
    return `These are the current BBQ packages from the catalog:\n${lines.join('\n')}\nPersonalized is built to the event — I won't invent a price for it.`
  }
  if (language === 'es') {
    return `Estos son los paquetes BBQ actuales del catálogo:\n${lines.join('\n')}\nEl personalizado se arma por evento — no invento un precio.`
  }
  return `Estes são os pacotes BBQ atuais do catálogo:\n${lines.join('\n')}\nO Personalizado é montado por evento — não invento preço.`
}

export function packageDetailsReply(
  language: BrasinhaLanguage,
  pkg: PackageSummary | null,
): string | null {
  if (!pkg) return null
  if (pkg.custom || pkg.pricePerPerson == null || pkg.pricePerPerson <= 0) {
    return language === 'en'
      ? `${pkg.label} is assembled for the event. I'll confirm pricing with the CDL team so I don't invent a number.`
      : language === 'es'
        ? `${pkg.label} se arma para el evento. Voy a confirmar el precio con el equipo CDL para no inventar un número.`
        : `${pkg.label} é montado para o evento. Vou confirmar o preço com a equipe CDL para não inventar um valor.`
  }
  const price = money(pkg.pricePerPerson, pkg.currency)
  if (language === 'en') {
    return `${pkg.label} is ${price} per person in the current catalog. Sides, extras, mileage and date rules are added only from canonical pricing.`
  }
  if (language === 'es') {
    return `${pkg.label} cuesta ${price} por persona en el catálogo actual. Guarniciones, extras, millas y fechas solo entran por el pricing canónico.`
  }
  return `${pkg.label} custa ${price} por pessoa no catálogo atual. Guarnições, extras, milhas e datas só entram pelo pricing canônico.`
}

export function grillReply(language: BrasinhaLanguage, fee: number): string {
  const price = money(fee, 'USD')
  if (language === 'en') {
    return `Yes. If the venue has no grill, rental is required. The canonical rental fee is ${price}. I don't change that value.`
  }
  if (language === 'es') {
    return `Sí. Si el local no tiene parrilla, el alquiler es obligatorio. La tarifa canónica es ${price}. No cambio ese valor.`
  }
  return `Sim. Se o local não tiver churrasqueira, o aluguel é obrigatório. A tarifa canônica é ${price}. Eu não altero esse valor.`
}

export function waiterReply(
  language: BrasinhaLanguage,
  fee: number | null,
  fromCatalog: CatalogHit | null,
): string {
  const price = money(fromCatalog?.price ?? fee, fromCatalog?.currency || 'USD')
  if (!price) {
    return language === 'en'
      ? "I'll confirm waiter pricing with the CDL team so I don't pass along an incorrect number."
      : language === 'es'
        ? 'Voy a confirmar el precio del mozo con el equipo CDL para no pasarte un número incorrecto.'
        : 'Vou confirmar o valor do garçom com a equipe CDL para não te passar um número incorreto.'
  }
  if (language === 'en') {
    return `Yes, waiter service is available. The current catalog/rule price is ${price}.`
  }
  if (language === 'es') {
    return `Sí, hay servicio de mozo. El precio actual del catálogo/regla es ${price}.`
  }
  return `Sim, temos garçom. O preço atual do catálogo/regra é ${price}.`
}

export function rulesReply(language: BrasinhaLanguage, rules: PublicRulesSnapshot): string {
  const sides = money(rules.sidesPricePerPerson, 'USD')
  if (language === 'en') {
    return `Public rules from the commercial source: sides ${sides}/person, weekday minimum ${money(rules.minOrderWeekday, 'USD')}, weekend minimum ${money(rules.minOrderWeekend, 'USD')}, reservation ${rules.reservationPercentage}%.`
  }
  if (language === 'es') {
    return `Reglas públicas de la fuente comercial: guarniciones ${sides}/persona, mínimo entre semana ${money(rules.minOrderWeekday, 'USD')}, fin de semana ${money(rules.minOrderWeekend, 'USD')}, reserva ${rules.reservationPercentage}%.`
  }
  return `Regras públicas da fonte comercial: guarnições ${sides}/pessoa, mínimo em dia de semana ${money(rules.minOrderWeekday, 'USD')}, fim de semana ${money(rules.minOrderWeekend, 'USD')}, reserva ${rules.reservationPercentage}%.`
}

export function quoteIntentReply(
  language: BrasinhaLanguage,
  guests: number | null,
): string {
  const guestBit =
    guests != null
      ? language === 'en'
        ? ` for ${guests} guests`
        : language === 'es'
          ? ` para ${guests} personas`
          : ` para ${guests} pessoas`
      : ''
  if (language === 'en') {
    return `I can prepare a quote intent${guestBit}. I still need name, phone, date, time, adults, children, address, whether the venue has a grill, package and extras. I will not invent a total or create a draft until the canonical quote pipeline is reused.`
  }
  if (language === 'es') {
    return `Puedo preparar una intención de cotización${guestBit}. Aún necesito nombre, teléfono, fecha, horario, adultos, niños, dirección, si hay parrilla, paquete y extras. No invento un total ni creo un borrador hasta reutilizar el pipeline canónico.`
  }
  return `Posso preparar uma intenção de cotação${guestBit}. Ainda preciso de nome, telefone, data, horário, adultos, crianças, endereço, se o local tem churrasqueira, pacote e extras. Não invento total nem crio rascunho até reutilizar o pipeline canônico.`
}

export function catalogReply(language: BrasinhaLanguage, hits: CatalogHit[]): string {
  if (!hits.length) return ''
  const lines = hits.map((hit) => {
    const price = money(hit.price, hit.currency)
    return price ? `${hit.label}: ${price}` : hit.label
  })
  if (language === 'en') return `From the current catalog:\n${lines.join('\n')}`
  if (language === 'es') return `Del catálogo actual:\n${lines.join('\n')}`
  return `Do catálogo atual:\n${lines.join('\n')}`
}

export function quoteStatusReply(
  language: BrasinhaLanguage,
  found: { quoteNumber: string; status: string | null; total: number | null } | null,
): string {
  if (!found) {
    return language === 'en'
      ? "I couldn't find that quote number in this company. I'll confirm with the CDL team."
      : language === 'es'
        ? 'No encontré ese número de cotización en esta empresa. Voy a confirmar con el equipo CDL.'
        : 'Não encontrei esse número de cotação nesta empresa. Vou confirmar com a equipe CDL.'
  }
  const total = money(found.total, 'USD')
  if (language === 'en') {
    return `${found.quoteNumber} is on file for this company. Status: ${found.status || 'n/a'}${total ? `. Recorded total: ${total}` : ''}.`
  }
  if (language === 'es') {
    return `${found.quoteNumber} está registrada en esta empresa. Estado: ${found.status || 'n/d'}${total ? `. Total registrado: ${total}` : ''}.`
  }
  return `${found.quoteNumber} está nesta empresa. Status: ${found.status || 'n/d'}${total ? `. Total registrado: ${total}` : ''}.`
}
