import { formatPostalCode } from '../../../Lib/cep.ts'

export type AddressValues = {
  address: string
  addressNumber: string
  city: string
  state: string
  zipCode: string
}

function getAddressComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  useShort = false,
) {
  const match = components.find((component) => component.types.includes(type))
  if (!match) return ''
  return useShort ? match.short_name : match.long_name
}

export function parseGooglePlace(
  place: google.maps.places.PlaceResult,
): AddressValues {
  const components = place.address_components ?? []
  const streetNumber = getAddressComponent(components, 'street_number')
  const route = getAddressComponent(components, 'route')
  const city =
    getAddressComponent(components, 'locality') ||
    getAddressComponent(components, 'postal_town') ||
    getAddressComponent(components, 'administrative_area_level_2') ||
    getAddressComponent(components, 'sublocality_level_1')
  const state = getAddressComponent(
    components,
    'administrative_area_level_1',
    true,
  )
  const postalCode = getAddressComponent(components, 'postal_code')
  const postalSuffix = getAddressComponent(components, 'postal_code_suffix')
  const zipCode = formatPostalCode(
    postalCode && postalSuffix ? `${postalCode}-${postalSuffix}` : postalCode,
  )
  return {
    address:
      route ||
      place.formatted_address?.split(',')[0]?.trim() ||
      '',
    addressNumber: streetNumber,
    city,
    state,
    zipCode,
  }
}
