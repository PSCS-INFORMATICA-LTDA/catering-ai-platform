import { redirect } from 'next/navigation'
import { getAuthSession } from '@/Lib/auth/session'
import { isBrasinhaDevRuntimeAllowed } from '@/Lib/brasinha/env'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BrasinhaDevLegacyPage({
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
  const params = await searchParams
  const raw = params.c
  const conversationId = Array.isArray(raw) ? raw[0] : raw
  if (conversationId?.trim()) {
    redirect(`/brasinha?c=${encodeURIComponent(conversationId.trim())}`)
  }
  redirect('/brasinha')
}
