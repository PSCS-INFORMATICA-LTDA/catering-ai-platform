/** Helpers liquid glass (padrão Logistics / LogRx — sem domínio de frota). */

export function glassPanel(className = ''): string {
  return ['liquid-glass-panel', className].filter(Boolean).join(' ')
}

export function glassCard(className = ''): string {
  return ['liquid-glass-card', className].filter(Boolean).join(' ')
}

export function glassField(required = false, className = ''): string {
  return [
    'liquid-glass-field',
    required ? 'liquid-glass-field--required' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}
