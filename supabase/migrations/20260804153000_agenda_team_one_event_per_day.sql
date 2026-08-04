-- =============================================================================
-- Agenda: 1 evento ativo por equipe por dia (scheduled/completed).
-- Cancelado libera a data. Ambiente-alvo: DEV.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_agenda_events_team_day_active
  ON public.agenda_events (company_id, team_id, event_date)
  WHERE status IN ('scheduled', 'completed');

COMMENT ON INDEX public.uq_agenda_events_team_day_active IS
  'Equipe com evento agendado/concluído não pode receber outro na mesma data.';
