'use client'

import type { MouseEvent, ReactNode } from 'react'
import { canUseDeviceSms, copyTextToClipboardSync } from '@/Lib/smsShare'

/**
 * Abre o app SMS nativo (padrão Logistics).
 * No PC: copia a mensagem e tenta o protocolo sms:.
 */
export default function SmsShareAnchor({
  href,
  message,
  className,
  title,
  'aria-label': ariaLabel,
  children,
  onOpen,
  onDesktopHint,
}: {
  href: string
  message: string
  className?: string
  title?: string
  'aria-label'?: string
  children: ReactNode
  onOpen?: () => void
  onDesktopHint?: () => void
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    copyTextToClipboardSync(message)
    onOpen?.()

    if (!canUseDeviceSms()) {
      onDesktopHint?.()
      return
    }

    event.preventDefault()
    window.location.href = href
  }

  return (
    <a
      href={href}
      title={title}
      aria-label={ariaLabel}
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  )
}
