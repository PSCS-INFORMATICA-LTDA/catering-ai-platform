declare namespace google.maps {
  interface MapsEventListener {
    remove(): void
  }

  interface GeocoderAddressComponent {
    long_name: string
    short_name: string
    types: string[]
  }

  interface LatLng {
    lat(): number
    lng(): number
  }

  interface LatLngLiteral {
    lat: number
    lng: number
  }

  interface LatLngBoundsLiteral {
    east: number
    north: number
    south: number
    west: number
  }

  interface LatLngBounds {
    getNorthEast(): LatLng
    getSouthWest(): LatLng
  }

  namespace places {
    interface AutocompleteOptions {
      types?: string[]
      componentRestrictions?: { country: string | string[] }
      fields?: string[]
      bounds?: LatLngBounds | LatLngBoundsLiteral
      strictBounds?: boolean
    }

    interface PlaceResult {
      address_components?: GeocoderAddressComponent[]
      formatted_address?: string
      geometry?: { location?: LatLng }
    }

    class Autocomplete {
      constructor(
        inputField: HTMLInputElement,
        opts?: AutocompleteOptions,
      )
      addListener(eventName: string, handler: () => void): MapsEventListener
      getPlace(): PlaceResult
      setBounds(bounds: LatLngBounds | LatLngBoundsLiteral): void
      setComponentRestrictions(restrictions: { country: string | string[] }): void
      setOptions(options: AutocompleteOptions): void
    }

    interface PlacesLibrary {
      Autocomplete: typeof Autocomplete
    }
  }

  enum TravelMode {
    BICYCLING = 'BICYCLING',
    DRIVING = 'DRIVING',
    TRANSIT = 'TRANSIT',
    WALKING = 'WALKING',
  }

  enum UnitSystem {
    IMPERIAL = 1,
    METRIC = 0,
  }

  type DistanceMatrixStatus =
    | 'OK'
    | 'INVALID_REQUEST'
    | 'MAX_ELEMENTS_EXCEEDED'
    | 'OVER_QUERY_LIMIT'
    | 'REQUEST_DENIED'
    | 'UNKNOWN_ERROR'

  interface DistanceMatrixResponseElement {
    status: DistanceMatrixStatus
    distance?: { text: string; value: number }
    duration?: { text: string; value: number }
  }

  interface DistanceMatrixResponse {
    rows: Array<{
      elements: DistanceMatrixResponseElement[]
    }>
  }

  interface DistanceMatrixRequest {
    origins: string[]
    destinations: string[]
    travelMode: TravelMode
    unitSystem: UnitSystem
  }

  class DistanceMatrixService {
    getDistanceMatrix(
      request: DistanceMatrixRequest,
      callback: (
        response: DistanceMatrixResponse | null,
        status: DistanceMatrixStatus,
      ) => void,
    ): void
  }

  interface RoutesLibrary {
    DistanceMatrixService: typeof DistanceMatrixService
  }

  type GeocoderStatus =
    | 'OK'
    | 'ZERO_RESULTS'
    | 'OVER_QUERY_LIMIT'
    | 'REQUEST_DENIED'
    | 'INVALID_REQUEST'
    | 'UNKNOWN_ERROR'
    | 'ERROR'

  interface GeocoderComponentRestrictions {
    country?: string | string[]
    postalCode?: string
    locality?: string
    administrativeArea?: string
    route?: string
  }

  interface GeocoderRequest {
    address?: string
    location?: LatLng | LatLngLiteral
    componentRestrictions?: GeocoderComponentRestrictions
    region?: string
  }

  interface GeocoderResult {
    address_components: GeocoderAddressComponent[]
    formatted_address: string
    geometry?: {
      location?: LatLng
      viewport?: LatLngBounds
    }
  }

  class Geocoder {
    geocode(
      request: GeocoderRequest,
      callback: (
        results: GeocoderResult[] | null,
        status: GeocoderStatus,
      ) => void,
    ): void
  }

  interface GeocodingLibrary {
    Geocoder: typeof Geocoder
  }

  function importLibrary(name: 'geocoding'): Promise<GeocodingLibrary>
  function importLibrary(name: 'places'): Promise<places.PlacesLibrary>
  function importLibrary(name: 'routes'): Promise<RoutesLibrary>
  function importLibrary(name: string): Promise<object>
}

interface Window {
  google?: typeof google
}
