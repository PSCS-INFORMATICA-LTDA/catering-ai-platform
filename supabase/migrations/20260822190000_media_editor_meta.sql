-- DEV ONLY target: yasprgtlqclwsjcshtls
-- NÃO aplicar em Production (eapwtirhevxrqinytans).
-- Optional jsonb for per-device focus/overlay once DDL is available.
-- Until this column exists, DEV persists a compact __m1 token in label_es (varchar 255).

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS editor_meta jsonb;
