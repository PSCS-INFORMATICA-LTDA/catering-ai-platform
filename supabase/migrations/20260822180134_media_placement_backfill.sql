-- =============================================================================
-- Media Manager V3 — backfill placement from entity_key namespace
-- Ambiente-alvo: Supabase DEV ONLY (yasprgtlqclwsjcshtls)
-- NÃO aplicar em Production (eapwtirhevxrqinytans).
--
-- Aditiva e idempotente. Sem DELETE. Sem DROP.
-- Não altera entity_type = event (grill photos).
-- Não altera entity_key, media_url, storage_path, active, editor_meta.
-- =============================================================================

UPDATE public.media_assets
SET placement = 'hero'
WHERE entity_type = 'public_landing'
  AND placement IS NULL
  AND entity_key LIKE 'hero:%';

UPDATE public.media_assets
SET placement = 'how_it_works'
WHERE entity_type = 'public_landing'
  AND placement IS NULL
  AND entity_key LIKE 'how_it_works:%';

UPDATE public.media_assets
SET placement = 'video'
WHERE entity_type = 'public_landing'
  AND placement IS NULL
  AND entity_key LIKE 'video:%';
