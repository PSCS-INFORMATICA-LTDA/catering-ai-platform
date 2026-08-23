import { formatPostalCode } from '../../../Lib/cep.ts'

export type AddressValues = {
  address: string
  addressNumber: string
  city: string
  state: string
  zipCode: string
  addressFormatted?: string
  addressPlaceId?: string | null
  addressCountry?: string
  addressLatitude?: number | null
  addressLongitude?: number | null
  addressSource?: 'google' | 'manual' | null
}

type GoogleAddressLike = {
  address_components?: google.maps.GeocoderAddressComponent[]
  formatted_address?: string
  geometry?: { location?: google.maps.LatLng }
  place_id?: string
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
  const country = getAddressComponent(components, 'country', true).toUpperCase()
  const location = place.geometry?.location
  return {
    address:
      route ||
      place.formatted_address?.split(',')[0]?.trim() ||
      '',
    addressNumber: streetNumber,
    city,
    state,
    zipCode,
    addressFormatted: place.formatted_address?.trim() || '',
    addressPlaceId: place.place_id?.trim() || null,
    addressCountry: country,
    addressLatitude: location ? location.lat() : null,
    addressLongitude: location ? location.lng() : null,
    addressSource: 'google',
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
      // The reverse geocoder resolves the nearest civic number, which is not the
      // number the customer selected. Only the Place's own street_number counts.
      addressNumber: parsed.addressNumber,
      city: parsed.city || geocoded.city,
      state: parsed.state || geocoded.state,
      zipCode: geocoded.zipCode || parsed.zipCode,
      addressFormatted:
        parsed.addressFormatted || geocoded.addressFormatted || '',
      addressPlaceId: parsed.addressPlaceId || geocoded.addressPlaceId || null,
      addressCountry: parsed.addressCountry || geocoded.addressCountry || '',
      addressLatitude:
        parsed.addressLatitude ?? geocoded.addressLatitude ?? null,
      addressLongitude:
        parsed.addressLongitude ?? geocoded.addressLongitude ?? null,
      addressSource: 'google',
    }
  } catch {
    return parsed
  }
}
