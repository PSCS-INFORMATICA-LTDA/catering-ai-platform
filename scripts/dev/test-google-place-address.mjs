import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildPostalBoundsAroundLocation,
  isSelectedPlaceCompatibleWithPostalCode as compatible,
} from '../../Lib/cep.ts'
import { parseGooglePlace } from '../../app/quotes/new/googlePlaces.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const addressFieldsSource = readFileSync(
  join(ROOT, 'app/quotes/new/AddressAutocompleteFields.tsx'),
  'utf8',
)

function component(type, longName, shortName = longName) {
  return { long_name: longName, short_name: shortName, types: [type] }
}

function place(components, formattedAddress = '') {
  return { address_components: components, formatted_address: formattedAddress }
}

function check(name, assertion) {
  assertion()
  console.log(`PASS  ${name}`)
}

check('T01 US exact ZIP', () => {
  assert.equal(compatible({ expectedPostalCode: '32801', selectedPostalCode: '32801' }), true)
})

check('T02 US ZIP+4 both directions', () => {
  assert.equal(compatible({ expectedPostalCode: '32801', selectedPostalCode: '32801-1234' }), true)
  assert.equal(compatible({ expectedPostalCode: '32801-9876', selectedPostalCode: '32801' }), true)
})

check('T03 US real mismatch', () => {
  assert.equal(compatible({ expectedPostalCode: '32801', selectedPostalCode: '32803' }), false)
})

check('T04 no postal_code with matching city/state', () => {
  assert.equal(compatible({
    expectedPostalCode: '32801', expectedCity: 'Orlando', expectedState: 'FL',
    selectedCity: 'Orlando', selectedState: 'FL',
  }), true)
  assert.match(addressFieldsSource, /enrichGooglePlaceFromGeocoder/)
})

check('T05 no postal_code with mismatching city/state', () => {
  assert.equal(compatible({
    expectedPostalCode: '32801', expectedCity: 'Orlando', expectedState: 'FL',
    selectedCity: 'Winter Park', selectedState: 'FL',
  }), false)
})

const orlandoPlace = place([
  component('street_number', '400'),
  component('route', 'West Church Street', 'W Church St'),
  component('locality', 'Orlando'),
  component('administrative_area_level_1', 'Florida', 'FL'),
  component('postal_code', '32801'),
], '400 W Church St, Orlando, FL 32801, USA')

check('T06 Orlando real address', () => {
  const parsed = parseGooglePlace(orlandoPlace)
  assert.equal(parsed.address, 'West Church Street')
  assert.equal(parsed.addressNumber, '400')
  assert.equal(parsed.city, 'Orlando')
  assert.equal(parsed.state, 'FL')
  assert.equal(parsed.zipCode, '32801')
  assert.equal(compatible({ expectedPostalCode: '32801', selectedPostalCode: parsed.zipCode }), true)
})

check('T07 BR CEP compatible', () => {
  assert.equal(compatible({ expectedPostalCode: '04650-160', selectedPostalCode: '04650-160' }), true)
})

check('T08 BR CEP mismatch', () => {
  assert.equal(compatible({ expectedPostalCode: '04650-160', selectedPostalCode: '04650-170' }), false)
})

check('T08b BR Google generic CEP requires authoritative street match', () => {
  const base = {
    expectedPostalCode: '04650-160',
    selectedPostalCode: '04650-000',
    expectedCity: 'São Paulo',
    expectedState: 'SP',
    selectedCity: 'São Paulo',
    selectedState: 'SP',
    expectedAddress: 'Rua Antônio Fogal',
  }
  assert.equal(compatible({ ...base, selectedAddress: 'Rua Antônio Fogal' }), true)
  assert.equal(compatible({ ...base, selectedAddress: 'Outra Rua' }), false)
})

check('T09 Google street number is parsed', () => {
  assert.equal(parseGooglePlace(orlandoPlace).addressNumber, '400')
})

check('T10 missing Google street number stays empty', () => {
  const parsed = parseGooglePlace(place([
    component('route', 'West Church Street', 'W Church St'),
    component('locality', 'Orlando'),
    component('administrative_area_level_1', 'Florida', 'FL'),
  ]))
  assert.equal(parsed.addressNumber, '')
})

check('T11 editing address invalidates canonical selection', () => {
  assert.match(addressFieldsSource, /clearCanonicalAddress/)
  assert.match(addressFieldsSource, /addressPlaceId: null/)
  assert.match(addressFieldsSource, /addressSource: null/)
})

check('T12 manual fallback can look up a postal code without pretending it is a Place', () => {
  assert.match(addressFieldsSource, /lookupPostalAddress/)
  assert.match(addressFieldsSource, /addressSource: 'manual'/)
  assert.match(addressFieldsSource, /manualMode/)
})

check('T13 postal center fallback creates strict local bounds', () => {
  const center = { lat: 28.5421, lng: -81.379 }
  const bounds = buildPostalBoundsAroundLocation(center)
  assert.ok(bounds.south < center.lat && bounds.north > center.lat)
  assert.ok(bounds.west < center.lng && bounds.east > center.lng)
})

check('T14 autocomplete restricts by allowed countries, not ZIP-first bounds', () => {
  assert.match(addressFieldsSource, /componentRestrictions/)
  assert.match(addressFieldsSource, /allowedCountries/)
  assert.doesNotMatch(addressFieldsSource, /strictBounds:\s*true/)
})

check('T15 Google Places init does not call importLibrary on a missing maps object', () => {
  assert.match(addressFieldsSource, /isGoogleMapsPlacesReady/)
  assert.match(addressFieldsSource, /!maps\?\.importLibrary/)
  assert.doesNotMatch(
    addressFieldsSource,
    /window\.google\?\.maps\s*\n\s*\.importLibrary/,
  )
})

console.log('GOOGLE-PLACE-ADDRESS: PASS')
