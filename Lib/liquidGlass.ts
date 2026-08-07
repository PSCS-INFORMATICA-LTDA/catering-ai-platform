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

export function glassTabsNav(className = ''): string {
  return ['liquid-glass-tabs-nav', className].filter(Boolean).join(' ')
}

export function glassTabLink(active = false, className = ''): string {
  return [
    'liquid-glass-tab-link',
    active ? 'liquid-glass-tab-link--active' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

export function glassBtn(
  tone: 'primary' | 'secondary' | 'ghost' | 'danger' = 'secondary',
  className = '',
): string {
  return [
    'liquid-glass-btn',
    `liquid-glass-btn--${tone}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

/** Ações de compartilhamento (WhatsApp / SMS / e-mail) — padrão Logistics. */
export type GlassActionTone = 'neutral' | 'green' | 'sky' | 'brand'

export function glassAction(
  tone: GlassActionTone = 'neutral',
  compact = false,
  className = '',
): string {
  return [
    'liquid-glass-action',
    `liquid-glass-action--${tone}`,
    compact ? 'liquid-glass-action--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}
