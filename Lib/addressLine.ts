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
