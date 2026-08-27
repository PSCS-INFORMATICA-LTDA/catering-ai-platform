import MediaContentManager from '@/components/media/MediaContentManager'
import { getAuthSession } from '@/Lib/auth/session'
import { hasPermission } from '@/Lib/auth/permissions'
import { tMedia } from '@/Lib/i18n/media'
import type { MediaWorkspaceView } from '@/components/media/mediaWorkspace'

export default async function MediaPage({
  initialView = 'library',
}: {
  initialView?: MediaWorkspaceView
}) {
  const session = await getAuthSession()
  const locale = session?.appUser?.preferred_language || 'pt'
  const canView = Boolean(
    session &&
      (session.isPlatformAdmin || hasPermission(session.permissions, 'media.view')),
  )
  const canManage = Boolean(
    session &&
      (session.isPlatformAdmin || hasPermission(session.permissions, 'media.manage')),
  )
  const canDelete = Boolean(
    session &&
      (session.isPlatformAdmin || hasPermission(session.permissions, 'media.delete')),
  )

  if (!session || !canView) {
    return (
      <main className="min-h-screen bg-cdl-bg px-4 py-10">
        <p className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 text-sm text-cdl-title">
          {tMedia(locale, 'forbidden')}
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cdl-bg px-4 py-8 sm:px-6">
      <MediaContentManager
        locale={locale}
        canManage={canManage}
        canDelete={canDelete}
        initialView={initialView}
      />
    </main>
  )
}
