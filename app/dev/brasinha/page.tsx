import { redirect } from 'next/navigation'
import { getAuthSession } from '@/Lib/auth/session'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { isBrasinhaDevRuntimeAllowed } from '@/Lib/brasinha/env'
import { getCompanyPersona } from '@/Lib/brasinha/persona'
import BrasinhaDevSimulator from './BrasinhaDevSimulator'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BrasinhaDevPage() {
  if (!isBrasinhaDevRuntimeAllowed()) {
    redirect('/')
  }
  const session = await getAuthSession()
  if (!session) {
    redirect('/login')
  }
  const companyId = resolveAuthorizedCompanyId(session)
  const persona = getCompanyPersona(companyId)

  return (
    <BrasinhaDevSimulator
      companyId={companyId}
      personaName={persona.name}
      personaRole={persona.role}
    />
  )
}
