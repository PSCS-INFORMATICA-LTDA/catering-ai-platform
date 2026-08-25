import { redirect } from 'next/navigation'
import { getAuthSession } from '@/Lib/auth/session'
import { hasPermission } from '@/Lib/auth/permissions'
import { tMedia } from '@/Lib/i18n/media'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CatalogImagesPage() {
  const session = await getAuthSession()
  const locale = session?.appUser?.preferred_language || 'pt'
  if (!session) redirect('/login')
  const canView =
    session.isPlatformAdmin || hasPermission(session.permissions, 'media.view')
  if (!canView) {
    return (
      <main className="min-h-screen bg-cdl-bg px-4 py-10">
        <p className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 text-sm text-cdl-title">
          {tMedia(locale, 'forbidden')}
        </p>
      </main>
    )
  }
  redirect('/media/packages')
}
