import type { MediaLocale, MediaPlacement, MediaVariant } from './constants'
import type { MediaEditorMeta } from './editorMeta'

export type PublicMediaAsset = {
  id: string
  company_id: string
  entity_type: string
  entity_id: string | null
  entity_key: string | null
  media_type: string
  media_url: string | null
  storage_path: string | null
  poster_url: string | null
  label_pt: string | null
  label_en: string | null
  label_es: string | null
  alt_pt: string | null
  alt_en: string | null
  alt_es: string | null
  title_pt: string | null
  title_en: string | null
  title_es: string | null
  subtitle_pt: string | null
  subtitle_en: string | null
  subtitle_es: string | null
  placement: MediaPlacement | null
  variant: MediaVariant | null
  display_order: number
  active: boolean
  created_at: string | null
  updated_at: string | null
  editor: MediaEditorMeta
  editorStored: boolean
}

export type PublicHowItWorksVideo = {
  src: string
  poster: string | null
  locale: MediaLocale
}

export type MediaCatalogImageItem = {
  id: string
  name: string
  imageUrl: string | null
  kind: 'package' | 'additional'
}
