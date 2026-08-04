'use client'

import BuildVersionBadge from '@/components/BuildVersionBadge'

/**
 * Compat: o menu lateral passou para AppShell / AuthenticatedShell.
 * Mantém apenas o badge de versão onde ainda for montado.
 */
export default function AppMainNav({ className = '' }: { className?: string }) {
  return (
    <div className={`w-full ${className}`}>
      <BuildVersionBadge className="hidden sm:block" />
    </div>
  )
}
