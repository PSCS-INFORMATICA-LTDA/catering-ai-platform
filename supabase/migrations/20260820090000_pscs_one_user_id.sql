-- Compatibility projection: PSCS One global user id on local Catering app_users.
-- Does not replace Auth. Does not disable RLS. DEV + later HML only.

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS pscs_one_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_pscs_one_user_id_uidx
  ON public.app_users (pscs_one_user_id)
  WHERE pscs_one_user_id IS NOT NULL;
