# Google Calendar sync — foundation (not implemented)

**DEV architecture note** — Catering AI Platform  
**Status:** DOCUMENTED ONLY — OAuth / sync **pending**  
**Date:** 2026-08-13

## Principle

`agenda_events` is the **canonical operational calendar**.

Google Calendar must be a **projection / sync** of that row — never a parallel source of truth and never a second event created only because an OS was opened.

```
agenda_event (canonical)
  └── calendar_event_sync (external projection)
        provider = google
        external_event_id = …
```

When deposit reserves the agenda → future: create Google event.  
When datetime changes → update.  
When cancelled → cancel/remove per policy.  
When converted to OS → **update** title/description/status — **do not** create another Google event.

## Proposed tables (future)

### `calendar_connections`

| Column | Notes |
| --- | --- |
| id | uuid |
| company_id | tenant |
| subject_type | `company` \| `branch` \| `team` \| `person` |
| subject_id | uuid nullable |
| provider | `google` |
| external_calendar_id | Google calendar id |
| status | `active` \| `revoked` \| `error` |
| token_ref | reference to secret store / Vault — **never** raw refresh tokens in app tables |
| sync_settings | jsonb (title template, include location, etc.) |
| timezone | IANA tz from Branch/Company |
| created_at / updated_at | |

### `calendar_event_sync`

| Column | Notes |
| --- | --- |
| id | uuid |
| company_id | |
| agenda_event_id | FK → agenda_events |
| provider | `google` |
| external_event_id | |
| sync_status | `pending` \| `synced` \| `error` \| `tombstoned` |
| last_synced_at | |
| last_error | text nullable |
| unique (provider, agenda_event_id) | |

## Title template (configurable, no finance)

Example: `BBQ — {client} — {quote_or_os_code}`

**Never** include: price, margin, balance, costs, reservation %.

## Timezone

Use Branch/Company timezone for Google `start`/`end`. Do not assume UTC-only or a single global TZ.

## Future triggers (hooks)

| Catering action | Future Google action |
| --- | --- |
| Deposit → `reserved` | Create external event |
| Sync datetime / title | Patch external event |
| Cancel reservation | Cancel/delete per policy |
| Convert → OS linked | Patch description/status only |
| Team assigned | Optional attendee/calendar update |

Suggested internal hook name later: `enqueueAgendaExternalSync(agenda_event_id, reason)`.

## Security

- Store OAuth tokens only via secure secret reference
- RLS: connections and sync rows scoped by `company_id`
- Public proposal pages must never expose sync tokens

## Next steps (implementation backlog)

1. Decide connection subject (company calendar vs team calendars)
2. Google OAuth consent + token vault
3. Migrations for `calendar_connections` + `calendar_event_sync`
4. Worker/queue for sync retries
5. Wire enqueue on `confirmQuoteDepositAndReserveSchedule`, sync, cancel, convert
6. QA against Google Calendar test project (DEV only)

**Out of scope for the deposit→agenda fix:** full OAuth, Google API client, production enablement.
