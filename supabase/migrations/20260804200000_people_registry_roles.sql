-- =============================================================================
-- Cadastro único de pessoas (Address Book) + vínculo da equipe a uma pessoa
-- Ambiente-alvo: DEV. Idempotente.
-- =============================================================================

-- Flags de papel (uma pessoa pode ter vários)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_customer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_supplier boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_team boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.customers.is_customer IS
  'Flag: pessoa atua como cliente (cotações / eventos).';
COMMENT ON COLUMN public.customers.is_supplier IS
  'Flag: pessoa atua como fornecedor.';
COMMENT ON COLUMN public.customers.is_team IS
  'Flag: pessoa atua como contato da equipe operacional (WhatsApp/SMS/e-mail).';

-- Garante pelo menos um papel se tudo vier false (trigger leve)
CREATE OR REPLACE FUNCTION public.customers_ensure_role_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.is_customer, false) = false
     AND COALESCE(NEW.is_supplier, false) = false
     AND COALESCE(NEW.is_team, false) = false THEN
    NEW.is_customer := true;
  END IF;

  -- Espelha em address_book_role (legado / relatórios)
  NEW.address_book_role := NULLIF(
    trim(both ',' FROM concat_ws(
      ',',
      CASE WHEN NEW.is_customer THEN 'customer' END,
      CASE WHEN NEW.is_supplier THEN 'supplier' END,
      CASE WHEN NEW.is_team THEN 'team' END
    )),
    ''
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_ensure_role_flag ON public.customers;
CREATE TRIGGER trg_customers_ensure_role_flag
  BEFORE INSERT OR UPDATE OF is_customer, is_supplier, is_team
  ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.customers_ensure_role_flag();

-- Backfill address_book_role para linhas existentes
UPDATE public.customers
SET
  is_customer = COALESCE(is_customer, true),
  is_supplier = COALESCE(is_supplier, false),
  is_team = COALESCE(is_team, false)
WHERE true;

-- Equipe operacional aponta para a pessoa (telefone, e-mail, endereço, idioma)
ALTER TABLE public.operational_teams
  ADD COLUMN IF NOT EXISTS contact_person_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operational_teams_contact_person_id_fkey'
  ) THEN
    ALTER TABLE public.operational_teams
      ADD CONSTRAINT operational_teams_contact_person_id_fkey
      FOREIGN KEY (contact_person_id)
      REFERENCES public.customers (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_operational_teams_contact_person
  ON public.operational_teams (contact_person_id)
  WHERE contact_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_role_flags
  ON public.customers (company_id, is_customer, is_supplier, is_team)
  WHERE active = true;

COMMENT ON COLUMN public.operational_teams.contact_person_id IS
  'Pessoa do Address Book (contato da equipe: telefone, e-mail, endereço, idioma).';
