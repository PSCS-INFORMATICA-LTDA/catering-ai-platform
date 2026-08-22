import { revalidatePath } from 'next/cache'
import { resetMediaAssetsSchemaCache } from './schema'

export function revalidatePublicMediaPages() {
  resetMediaAssetsSchemaCache()
  revalidatePath('/quote/[companySlug]/[locale]', 'page')
  revalidatePath('/quote', 'layout')
  revalidatePath('/media', 'page')
}
