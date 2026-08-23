-- =============================================================================
-- events.company_id — backfill + NOT NULL
-- Ambiente: DEV ONLY (yasprgtlqclwsjcshtls)
--
-- Causa do 42501 na criação de cotação:
--   policy events_insert_member
--   WITH CHECK (private.is_company_member(company_id))
--   private.is_company_member(NULL) = false
--
-- Esta migration NÃO altera policies, NÃO desabilita RLS,
-- NÃO usa USING(true) / WITH CHECK(true).
-- A correção de INSERT está no payload da aplicação (company_id do tenant).
-- =============================================================================

-- 1) Backfill a partir da cotação vinculada
UPDATE public.events AS e
SET company_id = q.company_id
FROM public.quotes AS q
WHERE q.event_id = e.id
  AND e.company_id IS NULL
  AND q.company_id IS NOT NULL;

-- 2) Backfill a partir do cliente, se houver
UPDATE public.events AS e
SET company_id = c.company_id
FROM public.customers AS c
WHERE c.id = e.customer_id
  AND e.company_id IS NULL
  AND c.company_id IS NOT NULL;

-- 3) Fixtures DEV órfãs (criadas pelo wizard/API antes do company_id no payload)
UPDATE public.events
SET company_id = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
WHERE company_id IS NULL
  AND event_name LIKE 'TESTE FUNCIONAL DEV%';

DO $$
DECLARE
  leftover integer;
BEGIN
  SELECT count(*) INTO leftover
  FROM public.events
  WHERE company_id IS NULL;

  IF leftover > 0 THEN
    RAISE NOTICE
      'events.company_id: % linhas ainda NULL — NOT NULL não aplicado',
      leftover;
    RETURN;
  END IF;

  ALTER TABLE public.events
    ALTER COLUMN company_id SET NOT NULL;

  RAISE NOTICE 'events.company_id agora NOT NULL';
END $$;

COMMENT ON COLUMN public.events.company_id IS
  'Tenant dono do evento. Obrigatório no INSERT (RLS events_insert_member). Imutável na prática: UPDATE não deve trocar de empresa.';
