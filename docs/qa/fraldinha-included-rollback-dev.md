# DEV rollback — Fraldinha (ANGUS) package inclusion

Applied only on DEV Supabase `yasprgtlqclwsjcshtls`. Production was not read or changed.

Caio confirmed Fraldinha (ANGUS) is not an included package item. The catalog additional
`768c6e24-d24c-4cca-9ca3-35e7a789f54b` stays active so it can still be sold à la carte.

## Before

`package_items.included = true` and `active = true` on these rows:

| Package | package_items.id |
| --- | --- |
| BBQSEL `aeab0e55-e41e-4632-9277-21e8b2031d50` | `8cc2e0ec-a79d-4146-beca-3eef5adc1c02` |
| BBQCHO `b8808ff7-f16e-40ec-8eae-0fe62c03cc23` | `1c6c058f-a3e0-487e-b68a-17df6168e65b` |
| BBQPRI `3d1734fd-7604-4335-b7f0-d2da238fac27` | `e45e4104-73a1-403c-a5cc-743654f43462` |
| BBQLUX `4ed04005-d4c8-4efb-9999-3733d01ab72c` | `36949265-578a-4d0b-8c43-b9e4cd034f54` |
| BBQSEL+ `95a67f3e-3c1c-4eb1-ad5b-6012d7fbea71` | `e37854e9-22e1-41a9-996f-f2f52c409d5e` |
| BBQCHO+ `a10cbb3d-2b13-42d1-8b34-e440218cdb12` | `d1b79e1f-125b-45f0-8307-b4f4715a1698` |
| BBQPRI+ `30f75230-461b-4043-8598-9ad0dd1aa580` | `567ab488-cf60-4ead-9275-de3aa6ac18ed` |
| BBQLUX+ `2f7a3be6-c103-4a1c-b6a5-58b226723950` | `d03376d6-f3bc-41aa-91ca-2b7bf9c7158f` |

## Change

`included` set to `false`. Rows stay active. The catalog item is not deleted.

## Rollback

```sql
UPDATE public.package_items
SET included = true, updated_at = now()
WHERE company_id = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
  AND id IN (
    '8cc2e0ec-a79d-4146-beca-3eef5adc1c02',
    '1c6c058f-a3e0-487e-b68a-17df6168e65b',
    'e45e4104-73a1-403c-a5cc-743654f43462',
    '36949265-578a-4d0b-8c43-b9e4cd034f54',
    'e37854e9-22e1-41a9-996f-f2f52c409d5e',
    'd1b79e1f-125b-45f0-8307-b4f4715a1698',
    '567ab488-cf60-4ead-9275-de3aa6ac18ed',
    'd03376d6-f3bc-41aa-91ca-2b7bf9c7158f'
  );
```
