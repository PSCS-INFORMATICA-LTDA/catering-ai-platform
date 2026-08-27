/**
 * Spike: PayPal Invoicing API vs Catering internal invoice.
 *
 * Findings (2026):
 * - PayPal Invoicing API (`/v2/invoicing/invoices`) is a hosted-invoice product.
 *   After send, PayPal exposes `detail.metadata.recipient_view_url`.
 * - PayPal Orders API v2 is a checkout/capture product and does not create a
 *   PayPal-hosted invoice. The two APIs are not mixed.
 * - Partial payments exist on Invoicing; Orders charges a server-chosen amount.
 * - CDL source of truth remains the Catering invoice snapshot (package, guests,
 *   grill, mileage, seasonal surcharge, 30/70). PayPal must not become the
 *   commercial ledger.
 *
 * Decision this round: keep internal invoices + Orders API v2 for sandbox
 * capture. Do not replace the Catering invoice with PayPal Invoicing.
 */
export const PAYPAL_INVOICING_SPIKE = {
  PAYPAL_INVOICING_API_AVAILABLE: true,
  PAYPAL_HOSTED_INVOICE_URL_AVAILABLE: true,
  INTERNAL_INVOICE_REMAINS_SOURCE_OF_TRUTH: true,
  SELECTED_CHECKOUT_API: 'orders_v2',
} as const
