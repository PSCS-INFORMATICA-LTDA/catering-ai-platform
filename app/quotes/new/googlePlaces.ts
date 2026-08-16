import { formatPostalCode } from '../../../Lib/cep.ts'

export type AddressValues = {
  address: string
  addressNumber: string
  city: string
  state: string
  zipCode: string
}

type GoogleAddressLike = {
  address_components?: google.maps.GeocoderAddressComponent[]
  formatted_address?: string
  geometry?: { location?: google.maps.LatLng }
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
  place: GoogleAddressLike,
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

export async function enrichGooglePlaceFromGeocoder(
  place: GoogleAddressLike,
  parsed: AddressValues,
): Promise<AddressValues> {
  if (!place.geometry?.location && !place.formatted_address) return parsed

  const maps = globalThis.window?.google?.maps
  if (!maps?.importLibrary) return parsed

  try {
    const { Geocoder } = (await maps.importLibrary(
      'geocoding',
    )) as google.maps.GeocodingLibrary
    const service = new Geocoder()
    const geocoded = await new Promise<AddressValues | null>((resolve) => {
      service.geocode(
        place.geometry?.location
          ? { location: place.geometry.location }
          : { address: place.formatted_address },
        (results, status) => {
          if (status !== 'OK' || !results?.[0]) {
            resolve(null)
            return
          }
          resolve(parseGooglePlace(results[0]))
        },
      )
    })

    if (!geocoded) return parsed
    return {
      address: parsed.address || geocoded.address,
      addressNumber: parsed.addressNumber || geocoded.addressNumber,
      city: parsed.city || geocoded.city,
      state: parsed.state || geocoded.state,
      zipCode: geocoded.zipCode || parsed.zipCode,
    }
  } catch {
    return parsed
  }
}
