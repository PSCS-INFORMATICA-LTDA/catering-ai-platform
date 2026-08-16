export type CepAddress = {
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
  formatted: string
}

export const INVALID_POSTAL_CODE_MESSAGE =
  'CEP inválido. Informe um CEP brasileiro (ex.: 01310-100) ou ZIP dos EUA (ex.: 32801).'

export function normalizeCep(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function normalizePostalDigits(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\D/g, '').slice(0, 9)
}

export function formatCep(value: string): string {
  const digits = normalizeCep(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function formatPostalCode(value: string | null | undefined): string {
  const digits = normalizePostalDigits(value)
  if (digits.length === 8) return formatCep(digits)
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return digits
}

export function isBrazilCep(value: string | null | undefined): boolean {
  return normalizePostalDigits(value).length === 8
}

export function isUsZip(value: string | null | undefined): boolean {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length === 5 || digits.length === 9
}

/** BR CEP (8 digits) or US ZIP (5 / ZIP+4). Rejects incomplete values. */
export function isUsablePostalCode(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  return isBrazilCep(value) || isUsZip(value)
}

export function inferCountryFromPostalCode(
  value: string | null | undefined,
): 'BR' | 'US' | null {
  if (isBrazilCep(value)) return 'BR'
  if (isUsZip(value)) return 'US'
  return null
}

function normalizePostalTerritoryText(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

export type SelectedPlacePostalCompatibility = {
  expectedPostalCode: string
  selectedPostalCode?: string | null
  expectedCity?: string | null
  expectedState?: string | null
  selectedCity?: string | null
  selectedState?: string | null
  expectedAddress?: string | null
  selectedAddress?: string | null
}

/**
 * Validates a selected Google Place against the territory already resolved
 * from the user's ZIP/CEP. US ZIP+4 values share the same five-digit base;
 * Brazilian CEPs must match all eight digits. Places without postal_code are
 * accepted only when both city and state match the resolved postal territory.
 */
export function isSelectedPlaceCompatibleWithPostalCode({
  expectedPostalCode,
  selectedPostalCode,
  expectedCity,
  expectedState,
  selectedCity,
  selectedState,
  expectedAddress,
  selectedAddress,
}: SelectedPlacePostalCompatibility): boolean {
  const country = inferCountryFromPostalCode(expectedPostalCode)
  const expectedDigits = normalizePostalDigits(expectedPostalCode)
  const selectedDigits = normalizePostalDigits(selectedPostalCode)

  if (!country || !expectedDigits) return false

  if (selectedDigits) {
    if (country === 'US') {
      return expectedDigits.slice(0, 5) === selectedDigits.slice(0, 5)
    }
    if (expectedDigits.length === 8 && selectedDigits === expectedDigits) {
      return true
    }

    const expectedStreetKey = normalizePostalTerritoryText(expectedAddress)
    const selectedStreetKey = normalizePostalTerritoryText(selectedAddress)
    return Boolean(
      expectedStreetKey &&
        selectedStreetKey === expectedStreetKey &&
        normalizePostalTerritoryText(expectedCity) ===
          normalizePostalTerritoryText(selectedCity) &&
        normalizePostalTerritoryText(expectedState) ===
          normalizePostalTerritoryText(selectedState),
    )
  }

  const expectedCityKey = normalizePostalTerritoryText(expectedCity)
  const expectedStateKey = normalizePostalTerritoryText(expectedState)
  const selectedCityKey = normalizePostalTerritoryText(selectedCity)
  const selectedStateKey = normalizePostalTerritoryText(selectedState)

  return Boolean(
    expectedCityKey &&
      expectedStateKey &&
      selectedCityKey === expectedCityKey &&
      selectedStateKey === expectedStateKey,
  )
}

export function postalCodeSaveError(
  value: string | null | undefined,
  required = false,
): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return required ? INVALID_POSTAL_CODE_MESSAGE : null
  if (!isUsablePostalCode(trimmed)) return INVALID_POSTAL_CODE_MESSAGE
  return null
}

export function formatAddressFromParts(data: {
  street: string
  address_number?: string
  neighborhood: string
  city: string
  state: string
  postal_code?: string
}): string {
  const line = [
    data.street,
    data.address_number,
    data.neighborhood,
    data.city,
    data.state,
    data.postal_code ? `CEP ${data.postal_code}` : '',
  ]
    .filter(Boolean)
    .join(', ')
  return line
}

export async function fetchAddressByCep(cepInput: string): Promise<CepAddress> {
  const cep = normalizeCep(cepInput)
  if (cep.length !== 8) {
    throw new Error('Informe um CEP válido com 8 dígitos.')
  }

  const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    const viaCep = await fetchViaCep(cep)
    if (viaCep) return viaCep
    throw new Error('CEP não encontrado. Verifique o número informado.')
  }

  const data = (await response.json()) as {
    state?: string
    city?: string
    neighborhood?: string
    street?: string
  }

  const street = data.street?.trim() ?? ''
  const neighborhood = data.neighborhood?.trim() ?? ''
  const city = data.city?.trim() ?? ''
  const state = data.state?.trim() ?? ''

  if (!city || !state) {
    throw new Error(
      'CEP encontrado, mas sem cidade/UF. Preencha o endereço manualmente.',
    )
  }

  return {
    cep: formatCep(cep),
    street,
    neighborhood,
    city,
    state,
    formatted: [street, neighborhood, city, state].filter(Boolean).join(', '),
  }
}

async function fetchViaCep(cep: string): Promise<CepAddress | null> {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    cache: 'no-store',
  })
  if (!response.ok) return null
  const data = (await response.json()) as {
    erro?: boolean
    logradouro?: string
    bairro?: string
    localidade?: string
    uf?: string
  }
  if (data.erro) return null
  const street = data.logradouro?.trim() ?? ''
  const neighborhood = data.bairro?.trim() ?? ''
  const city = data.localidade?.trim() ?? ''
  const state = data.uf?.trim() ?? ''
  return {
    cep: formatCep(cep),
    street,
    neighborhood,
    city,
    state,
    formatted: [street, neighborhood, city, state].filter(Boolean).join(', '),
  }
}

export type PostalLookupResult = {
  address: string
  city: string
  state: string
  zipCode: string
}

function readComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  useShort = false,
) {
  const match = components.find((item) => item.types.includes(type))
  if (!match) return ''
  return useShort ? match.short_name : match.long_name
}

export async function geocodePostalCode(
  zipCode: string,
  country: 'BR' | 'US',
): Promise<PostalLookupResult> {
  const maps = globalThis.window?.google?.maps
  if (!maps?.importLibrary) {
    throw new Error('GOOGLE_UNAVAILABLE')
  }

  const { Geocoder } = (await maps.importLibrary(
    'geocoding',
  )) as google.maps.GeocodingLibrary
  const service = new Geocoder()
  const formatted = formatPostalCode(zipCode)

  return new Promise((resolve, reject) => {
    service.geocode(
      {
        componentRestrictions: { country, postalCode: formatted },
      },
      (results, status) => {
        if (status === 'ZERO_RESULTS' || !results?.[0]) {
          reject(new Error('POSTAL_NOT_FOUND'))
          return
        }
        if (status !== 'OK') {
          reject(new Error('GEOCODE_FAILED'))
          return
        }
        const components = results[0].address_components
        const city =
          readComponent(components, 'locality') ||
          readComponent(components, 'postal_town') ||
          readComponent(components, 'sublocality_level_1') ||
          readComponent(components, 'administrative_area_level_2')
        const state = readComponent(
          components,
          'administrative_area_level_1',
          true,
        )
        if (!city || !state) {
          reject(new Error('POSTAL_NOT_FOUND'))
          return
        }
        resolve({
          address: readComponent(components, 'route'),
          city,
          state,
          zipCode:
            formatPostalCode(readComponent(components, 'postal_code')) ||
            formatted,
        })
      },
    )
  })
}

export async function lookupPostalAddress(
  zipCode: string,
): Promise<PostalLookupResult> {
  const country = inferCountryFromPostalCode(zipCode)
  if (!country) {
    throw new Error('INVALID_POSTAL_CODE')
  }

  if (country === 'BR') {
    const [brasil, google] = await Promise.all([
      fetchAddressByCep(zipCode).catch(() => null),
      geocodePostalCode(zipCode, 'BR').catch(() => null),
    ])
    const city = brasil?.city || google?.city || ''
    const state = brasil?.state || google?.state || ''
    const address = brasil?.street || google?.address || ''
    const formatted = brasil?.cep || google?.zipCode || formatPostalCode(zipCode)
    if (!city || !state) {
      throw new Error('POSTAL_NOT_FOUND')
    }
    return { address, city, state, zipCode: formatted }
  }

  return geocodePostalCode(zipCode, 'US')
}
