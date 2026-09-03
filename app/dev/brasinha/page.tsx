import { redirect } from 'next/navigation'
import { getAuthSession } from '@/Lib/auth/session'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { isBrasinhaDevRuntimeAllowed } from '@/Lib/brasinha/env'
import { getCompanyPersona } from '@/Lib/brasinha/persona'
import { createCanonicalCatalogPort } from '@/Lib/brasinha/tools/canonicalPort'
import BrasinhaDevSimulator from './BrasinhaDevSimulator'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BrasinhaDevPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!isBrasinhaDevRuntimeAllowed()) {
    redirect('/')
  }
  const session = await getAuthSession()
  if (!session) {
    redirect('/login')
  }
  const companyId = resolveAuthorizedCompanyId(session)
  const persona = getCompanyPersona(companyId)
  const params = await searchParams
  const raw = params.c
  const initialConversationId = Array.isArray(raw) ? raw[0] : raw ?? null

  let companyDisplayName: string | null = null
  try {
    const profile = await createCanonicalCatalogPort().getCompanyPublicProfile(
      companyId,
      'pt',
    )
    companyDisplayName = profile.data?.name?.trim() || null
  } catch {
    companyDisplayName = null
  }

  return (
    <BrasinhaDevSimulator
      companyId={companyId}
      companyDisplayName={companyDisplayName}
      personaName={persona.name}
      personaRole={persona.role}
      initialConversationId={initialConversationId}
    />
  )
}
