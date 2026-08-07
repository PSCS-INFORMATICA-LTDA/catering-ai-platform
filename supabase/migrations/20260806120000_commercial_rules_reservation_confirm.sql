-- Commercial rules totals + deposit confirmation gate (DEV)
-- holiday_surcharge_amount: persisted from quote engine
-- reservation_confirmed_*: staff confirms 30% deposit before agenda designate

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS holiday_surcharge_amount numeric(12, 2) DEFAULT 0;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS reservation_confirmed_at timestamptz;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS reservation_confirmed_by uuid;

COMMENT ON COLUMN public.quotes.holiday_surcharge_amount IS
  'Acréscimo de datas comemorativas CDL (ex.: 100% em 24/25/31 dez e 1 jan), em USD.';

COMMENT ON COLUMN public.quotes.reservation_confirmed_at IS
  'Quando a equipe confirmou o recebimento do sinal (30%) para fechar a agenda.';

COMMENT ON COLUMN public.quotes.reservation_confirmed_by IS
  'Usuário (auth.users) que confirmou o sinal.';
