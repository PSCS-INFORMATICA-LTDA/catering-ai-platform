export function composeAddressLine(
  address: string,
  addressNumber?: string | null,
) {
  const street = address.trim()
  const number = addressNumber?.trim() ?? ''
  if (!street) return number
  if (!number) return street
  if (street.includes(number)) return street
  return `${street}, ${number}`
}

/** Maps / mileage destination street: number first, then route. */
export function composeCanonicalStreetAddress(
  address: string,
  addressNumber?: string | null,
) {
  const street = address.trim()
  const number = addressNumber?.trim() ?? ''
  if (!street) return number
  if (!number) return street
  if (street.startsWith(`${number} `) || street.includes(` ${number}`)) {
    return street
  }
  return `${number} ${street}`
}

export function composeCanonicalDestination(parts: {
  address: string
  addressNumber?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}) {
  const street = composeCanonicalStreetAddress(parts.address, parts.addressNumber)
  const city = String(parts.city ?? '').trim()
  const region = String(parts.state ?? '').trim()
  const zip = String(parts.zipCode ?? '').trim()
  const locality = [city, [region, zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  return [street, locality].filter(Boolean).join(', ')
}

export function splitAddressNumber(addressLine: string | null | undefined): {
  address: string
  addressNumber: string
} {
  const value = addressLine?.trim() ?? ''
  if (!value) return { address: '', addressNumber: '' }
  const match = value.match(/^(.*?)[,\s]+(\d+[A-Za-z0-9\-\/]*)$/)
  if (!match) return { address: value, addressNumber: '' }
  return {
    address: match[1].trim(),
    addressNumber: match[2].trim(),
  }
}
