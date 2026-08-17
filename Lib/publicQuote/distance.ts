import 'server-only'

import { PublicQuoteHttpError } from './security'
import type { PublicQuoteDraft } from './types'

export type PublicQuoteMileageResult = {
  distance: number
  status: 'resolved' | 'pending_review'
}

function mapsApiKey() {
  return (
    process.env.GOOGLE_MAPS_ROUTES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ''
  ).trim()
}

function milesFromMeters(meters: number) {
  return Math.round((meters / 1609.344) * 10) / 10
}

function destinationAddress(draft: PublicQuoteDraft) {
  const address = draft.event.address
  return (
    address.formattedAddress ||
    [
      [address.route, address.number].filter(Boolean).join(', '),
      address.city,
      address.region,
      address.postalCode,
      address.country,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ')
  )
}

async function computeWithRoutesApi(
  apiKey: string,
  origin: string,
  draft: PublicQuoteDraft,
): Promise<number | null> {
  const destination = draft.event.address.placeId
    ? { placeId: draft.event.address.placeId }
    : { address: destinationAddress(draft) }
  const response = await fetch(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination,
        travelMode: 'DRIVE',
      }),
    },
  )
  if (!response.ok) return null
  const body = (await response.json()) as {
    routes?: Array<{ distanceMeters?: number }>
  }
  const meters = Number(body.routes?.[0]?.distanceMeters)
  return Number.isFinite(meters) && meters >= 0
    ? milesFromMeters(meters)
    : null
}

async function computeWithLegacyDistanceMatrix(
  apiKey: string,
  origin: string,
  draft: PublicQuoteDraft,
): Promise<number | null> {
  const params = new URLSearchParams({
    origins: origin,
    destinations: draft.event.address.placeId
      ? `place_id:${draft.event.address.placeId}`
      : destinationAddress(draft),
    mode: 'driving',
    units: 'imperial',
    key: apiKey,
  })
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
    { cache: 'no-store', signal: AbortSignal.timeout(8000) },
  )
  if (!response.ok) return null
  const body = (await response.json()) as {
    status?: string
    rows?: Array<{
      elements?: Array<{ status?: string; distance?: { value?: number } }>
    }>
  }
  const element = body.rows?.[0]?.elements?.[0]
  const meters = Number(element?.distance?.value)
  return body.status === 'OK' && element?.status === 'OK' && Number.isFinite(meters)
    ? milesFromMeters(meters)
    : null
}

/**
 * Server-owned mileage input for Pricing SSOT. The browser's distance value is
 * intentionally ignored. Routes API is preferred; the existing legacy Matrix
 * service is a compatibility fallback for older Google Cloud projects.
 */
export async function resolvePublicQuoteMileageDistance(
  draft: PublicQuoteDraft,
  originValue: string,
  options: { required?: boolean } = {},
): Promise<PublicQuoteMileageResult> {
  const origin = originValue.trim()
  const destination = destinationAddress(draft)
  if (!origin || !destination) {
    if (options.required) {
      throw new PublicQuoteHttpError(422, 'invalid_payload')
    }
    return { distance: 0, status: 'pending_review' }
  }

  const apiKey = mapsApiKey()
  if (!apiKey) {
    if (options.required) {
      throw new PublicQuoteHttpError(503, 'server_error')
    }
    return { distance: 0, status: 'pending_review' }
  }

  try {
    const current = await computeWithRoutesApi(apiKey, origin, draft)
    if (current != null) return { distance: current, status: 'resolved' }
    const legacy = await computeWithLegacyDistanceMatrix(apiKey, origin, draft)
    if (legacy != null) return { distance: legacy, status: 'resolved' }
  } catch {
    // Do not log the address or API response; both may contain sensitive data.
  }

  if (options.required) {
    throw new PublicQuoteHttpError(503, 'server_error')
  }
  return { distance: 0, status: 'pending_review' }
}

export async function computePublicQuoteMileageDistance(
  draft: PublicQuoteDraft,
  originValue: string,
  options: { required?: boolean } = {},
): Promise<number> {
  return (await resolvePublicQuoteMileageDistance(draft, originValue, options))
    .distance
}
