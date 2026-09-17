export function maskPhone(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return '—'
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 6) return '••••'
  return `+${digits.slice(0, 2)}••••${digits.slice(-4)}`
}
