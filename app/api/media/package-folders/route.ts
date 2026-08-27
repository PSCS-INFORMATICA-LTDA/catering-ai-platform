import { requireApiPermission } from '@/Lib/auth/requireApi'
import { noStoreJson } from '@/Lib/media/batchValidate'
import {
  listPackageFolderDrafts,
  listPublishedFolderObjects,
} from '@/Lib/media/packageFolderDrafts'
import {
  listPackageFolderSlots,
  mappedFolderFileNames,
} from '@/Lib/media/packageFolderSlots'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiPermission('media.view')
  if (!auth.ok) return auth.response
  const supabase = getSupabaseServerClient()
  const slots = listPackageFolderSlots('pt')
  const [{ drafts, error: draftError }, published] = await Promise.all([
    listPackageFolderDrafts(supabase),
    listPublishedFolderObjects(supabase),
  ])
  const mapped = mappedFolderFileNames()
  const orphans = published.files.filter((name) => !mapped.has(name))
  return noStoreJson({
    slots: slots.map((slot) => ({
      ...slot,
      drafts: drafts.filter((draft) => draft.slotKey === slot.slotKey),
    })),
    orphans,
    draftError,
    publishedListError: published.error,
    publishLiveDisabled: true,
  })
}
