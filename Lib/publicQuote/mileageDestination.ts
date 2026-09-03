/**
 * Mileage destination shown on the public review.
 *
 * The customer just typed and confirmed this address, so echoing back a generic
 * "event location" tells them nothing — they need to see which address the
 * distance was measured to. Display only: the mileage engine resolves its own
 * destination server-side and is untouched by this.
 */
export function mileageDestinationAddress(eventAddressText: string): string {
  const parts = eventAddressText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}
