# Quote deposit → Agenda reservation

**DEV only** — Supabase `yasprgtlqclwsjcshtls`  
**Owner:** Philippe Santana / PSCS  
**Date:** 2026-08-13

## Problem (before)

Confirming the client deposit (`reservation_confirmed_at`) did **not** reserve the Agenda.  
`agenda_events` were created mainly on team designation / OS conversion, so the board still showed the slot as free after sinal confirmation.

## Canonical rule

```
Quote accepted
  → Deposit / reservation confirmed  ← TRIGGER
  → agenda_events status = reserved (quote_id set, service_order_id null)
  → later: team designation (optional) → status scheduled, team_id set
  → later: convert to OS → same row gets service_order_id (no second event)
```

## Canonical server action

`Lib/quotes/confirmQuoteDepositAndReserveSchedule.ts`

- `confirmQuoteDepositAndReserveSchedule()` — used by `POST /api/quotes/[id]/reservation-confirm`
- `syncReservedAgendaEventForQuote()` — after quote/event datetime edits when deposit already confirmed
- `cancelAgendaReservationForQuote()` — on quote deactivate (soft cancel, history kept)

### Steps

1. Validate quote (company, active, accepted)
2. Persist `reservation_confirmed_at` / `reservation_confirmed_by` (idempotent)
3. Require linked `events` with date + start/end
4. Conflict check (company-wide window + turnaround; `reserved|scheduled|completed`)
5. Upsert `agenda_events` by `(company_id, quote_id)` active unique index
6. Status `reserved`, `team_id` nullable, `service_order_id` null
7. Audit: `reservation_confirmed`, `agenda_reserved_on_deposit`

## Schema

Migration `20260813100000_quote_deposit_agenda_reservation.sql`:

- status check includes `reserved`
- `team_id` nullable
- unique `uq_agenda_events_quote_active`
- `cancelled_at` / `cancelled_by`

## Lifecycle

| State | Agenda |
| --- | --- |
| Quote open / accepted without deposit | No hard reservation |
| Deposit confirmed | `reserved` (may have no team) |
| Team designated | same row → `scheduled` + `team_id` |
| Converted to OS | same row → `service_order_id` + `scheduled` |
| Quote deactivated (no OS) | `cancelled` + audit |

## Idempotency

- Re-confirm deposit → same `agenda_event`
- Convert twice → link only, no insert
- Unique index on active `(company_id, quote_id)`

## Conflicts

Uses existing turnaround engine (`canScheduleNextEvent`), not “one team event per day”.

## Date/time change after deposit

`updateQuote` calls `syncReservedAgendaEventForQuote`. On conflict, event row is reverted and save fails.

## Cancel

`deactivateQuote` → `cancelAgendaReservationForQuote` (only rows without `service_order_id`).

## Convert

`attachAgendaToConvertedOrder` in `convertAcceptedQuoteToServiceOrder.ts`:

1. `UPDATE` existing by `quote_id`
2. If missing (exception): sync/create + audit `agenda_created_on_convert_fallback`

## QA

```bash
npm.cmd run test:dev:quote-deposit-agenda-reservation
```

Covers T01–T18 (deposit, agenda before OS, convert link, idempotency, conflicts, no-team, move, cancel).

## Related UI / i18n

- Agenda legend: Reserved / Scheduled / Completed / Free
- Row **Reservado (sem equipe)** for `team_id` null
- Copy no longer says “one team event per date”
