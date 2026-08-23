import DataDictionaryDashboard from '@/components/settings/DataDictionaryDashboard'
import { hasPermission } from '@/Lib/auth/permissions'
import { getAuthSession } from '@/Lib/auth/session'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DataDictionaryPage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/settings/dictionary')

  const allowed =
    hasPermission(session.permissions, 'data_dictionary.view') ||
    hasPermission(session.permissions, 'translation_dictionary.view')
  if (!allowed) redirect('/quotes')

  return (
    <main className="p-4 sm:p-6">
      <DataDictionaryDashboard />
    </main>
  )
}
