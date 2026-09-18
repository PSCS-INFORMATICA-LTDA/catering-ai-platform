/**
 * Disposable Postgres lineage test for Notification Center V1–V1.3.
 * Never targets shared DEV or PROD.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrations = [
  'supabase/migrations/20260917190000_notification_center_v1.sql',
  'supabase/migrations/20260918183219_notification_center_v12_auto.sql',
  'supabase/migrations/20260918213000_notification_center_v13_lineage.sql',
]

function sha(rel) {
  return createHash('sha256').update(readFileSync(join(root, rel))).digest('hex')
}

const checksums = Object.fromEntries(migrations.map((file) => [file, sha(file)]))

function psqlAvailable() {
  return spawnSync('psql', ['--version'], { encoding: 'utf8' }).status === 0
}

function dockerAvailable() {
  return spawnSync('docker', ['--version'], { encoding: 'utf8' }).status === 0
}

const harness = `
create extension if not exists pgcrypto;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end
$$;
create schema if not exists private;
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text
);
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  display_name text
);
create table if not exists public.permissions (
  permission_key text primary key,
  label_pt text,
  label_en text,
  label_es text,
  category_key text,
  active boolean default true
);
create table if not exists public.role_permissions (
  role_key text not null,
  permission_key text not null,
  primary key (role_key, permission_key)
);
create or replace function private.has_permission(p_company uuid, p_key text)
returns boolean language sql stable as $$ select true $$;
`

const cases = `
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  person_a uuid := gen_random_uuid();
  person_b uuid := gen_random_uuid();
  rec_a uuid := gen_random_uuid();
  rec_b uuid := gen_random_uuid();
  ev_a uuid;
  ev_b uuid;
begin
  insert into public.companies(id, name) values (a, 'Company A'), (b, 'Company B');
  insert into public.customers(id, company_id, display_name)
    values (person_a, a, 'Person A'), (person_b, b, 'Person B');

  insert into public.notification_recipients(id, company_id, channel, locale, phone_e164, consent_status, person_id)
    values
      (rec_a, a, 'whatsapp', 'pt', '+10000000001', 'unknown', person_a),
      (rec_b, b, 'whatsapp', 'pt', '+10000000002', 'unknown', person_b);

  insert into public.notification_subscriptions(company_id, recipient_id, event_key, enabled)
    values (a, rec_a, 'quote.created', true);

  begin
    insert into public.notification_subscriptions(company_id, recipient_id, event_key, enabled)
      values (a, rec_b, 'quote.created', true);
    raise exception 'expected_cross_company_subscription_reject';
  exception
    when foreign_key_violation then null;
  end;

  insert into public.notification_events(company_id, event_key, entity_type, entity_id)
    values (a, 'quote.created', 'quote', gen_random_uuid())
    returning id into ev_a;
  insert into public.notification_events(company_id, event_key, entity_type, entity_id)
    values (b, 'quote.created', 'quote', gen_random_uuid())
    returning id into ev_b;

  insert into public.notification_deliveries(company_id, event_id, recipient_id, channel, idempotency_key)
    values (a, ev_a, rec_a, 'whatsapp', 'a-ok');

  begin
    insert into public.notification_deliveries(company_id, event_id, recipient_id, channel, idempotency_key)
      values (a, ev_b, rec_a, 'whatsapp', 'a-event-b');
    raise exception 'expected_cross_company_event_reject';
  exception
    when foreign_key_violation then null;
  end;

  begin
    insert into public.notification_deliveries(company_id, event_id, recipient_id, channel, idempotency_key)
      values (a, ev_a, rec_b, 'whatsapp', 'a-rec-b');
    raise exception 'expected_cross_company_recipient_reject';
  exception
    when foreign_key_violation then null;
  end;

  begin
    insert into public.notification_recipients(company_id, channel, locale, phone_e164, person_id)
      values (a, 'whatsapp', 'pt', '+10000000003', person_b);
    raise exception 'expected_cross_company_person_reject';
  exception
    when foreign_key_violation then null;
  end;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'notification_events'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) then
    raise exception 'authenticated_must_not_write_events';
  end if;

  if exists (
    select 1
    from public.notification_recipients ra
    join public.notification_recipients rb
      on ra.phone_e164 = rb.phone_e164
     and ra.company_id = a
     and rb.company_id = b
  ) then
    raise exception 'company_b_inherited_company_a_phone';
  end if;

  if exists (
    select 1
    from public.company_notification_providers p
    where p.company_id = b
  ) then
    raise exception 'company_b_inherited_company_a_sender';
  end if;
end
$$;

create table if not exists private.session_grants (
  user_id uuid not null,
  company_id uuid not null,
  permission_key text not null
);

create or replace function private.has_permission(p_company uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = private, public
as $$
  select exists (
    select 1
    from private.session_grants g
    where g.company_id = p_company
      and g.permission_key = p_key
      and g.user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  );
$$;
grant execute on function private.has_permission(uuid, text) to authenticated;

do $$
declare
  company_a uuid;
  company_b uuid;
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  seen_a int;
  seen_b int;
  seen_cross int;
begin
  select id into company_a from public.companies where name = 'Company A';
  select id into company_b from public.companies where name = 'Company B';
  insert into private.session_grants(user_id, company_id, permission_key)
  values
    (user_a, company_a, 'notifications.view'),
    (user_a, company_a, 'notification_deliveries.view'),
    (user_b, company_b, 'notifications.view'),
    (user_b, company_b, 'notification_deliveries.view');

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  execute 'set role authenticated';
  select count(*) into seen_a from public.notification_recipients;
  select count(*) into seen_cross
    from public.notification_recipients
    where company_id = company_b;
  execute 'reset role';
  if seen_a <> 1 or seen_cross <> 0 then
    raise exception 'user_a_read_isolation_failed a=% cross=%', seen_a, seen_cross;
  end if;

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  execute 'set role authenticated';
  select count(*) into seen_b from public.notification_recipients;
  select count(*) into seen_cross
    from public.notification_recipients
    where company_id = company_a;
  execute 'reset role';
  if seen_b <> 1 or seen_cross <> 0 then
    raise exception 'user_b_read_isolation_failed b=% cross=%', seen_b, seen_cross;
  end if;
end
$$;
`

function runSql(sql) {
  const apply = spawnSync(
    'sudo',
    ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-d', 'nc_lineage', '-c', sql],
    { encoding: 'utf8' },
  )
  return apply
}

function runWithLocalPsql() {
  const dropdb = spawnSync('sudo', ['-u', 'postgres', 'psql', '-c', 'drop database if exists nc_lineage'], {
    encoding: 'utf8',
  })
  if (dropdb.status !== 0) {
    return { ok: false, detail: dropdb.stderr || dropdb.stdout }
  }
  const createdb = spawnSync('sudo', ['-u', 'postgres', 'psql', '-c', 'create database nc_lineage'], {
    encoding: 'utf8',
  })
  if (createdb.status !== 0) {
    return { ok: false, detail: createdb.stderr || createdb.stdout }
  }
  const sql = [
    harness,
    ...migrations.map((file) => readFileSync(join(root, file), 'utf8')),
    cases,
  ].join('\n\n')
  const apply = spawnSync(
    'sudo',
    ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-d', 'nc_lineage', '-f', '-'],
    { encoding: 'utf8', input: sql, maxBuffer: 20 * 1024 * 1024 },
  )
  spawnSync('sudo', ['-u', 'postgres', 'psql', '-c', 'drop database if exists nc_lineage;'], {
    encoding: 'utf8',
  })
  if (apply.status !== 0) {
    return { ok: false, detail: apply.stderr || apply.stdout }
  }
  return { ok: true, detail: 'local_psql' }
}

function runWithDocker() {
  const name = `nc-lineage-${Date.now()}`
  const start = spawnSync(
    'docker',
    [
      'run',
      '-d',
      '--rm',
      '--name',
      name,
      '-e',
      'POSTGRES_PASSWORD=postgres',
      '-e',
      'POSTGRES_DB=lineage',
      '-p',
      '55432:5432',
      'postgres:16-alpine',
    ],
    { encoding: 'utf8' },
  )
  if (start.status !== 0) return { ok: false, detail: start.stderr || start.stdout }
  try {
    for (let i = 0; i < 30; i += 1) {
      const ready = spawnSync(
        'docker',
        ['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'lineage'],
        { encoding: 'utf8' },
      )
      if (ready.status === 0) break
      spawnSync('sleep', ['1'])
    }
    const work = mkdtempSync(join(tmpdir(), 'nc-lineage-'))
    const sqlPath = join(work, 'run.sql')
    writeFileSync(
      sqlPath,
      [
        harness,
        ...migrations.map((file) => readFileSync(join(root, file), 'utf8')),
        cases,
      ].join('\n\n'),
    )
    const apply = spawnSync(
      'docker',
      ['exec', '-i', name, 'psql', '-U', 'postgres', '-d', 'lineage', '-v', 'ON_ERROR_STOP=1', '-f', '-'],
      { encoding: 'utf8', input: readFileSync(sqlPath, 'utf8') },
    )
    rmSync(work, { recursive: true, force: true })
    if (apply.status !== 0) {
      return { ok: false, detail: apply.stderr || apply.stdout }
    }
    return { ok: true, detail: 'docker_postgres' }
  } finally {
    spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' })
  }
}

const fileAsserts = () => {
  const v13 = readFileSync(join(root, migrations[2]), 'utf8')
  assert.match(v13, /notification_subscriptions_recipient_tenant_fkey/)
  assert.match(v13, /notification_deliveries_event_tenant_fkey/)
  assert.match(v13, /notification_deliveries_recipient_tenant_fkey/)
  assert.match(v13, /notification_recipients_person_tenant_fkey/)
  assert.match(v13, /revoke all on table public.notification_events from public, anon, authenticated/)
  assert.doesNotMatch(v13, /2242|Caio|407915/)
}

fileAsserts()

let runtime = { ok: false, detail: 'skipped_no_local_postgres' }
if (psqlAvailable()) {
  runtime = runWithLocalPsql()
} else if (dockerAvailable()) {
  runtime = runWithDocker()
}

console.log(
  JSON.stringify(
    {
      lineage_file_contract: 'PASS',
      checksums,
      runtime_postgres: runtime.ok ? 'PASS' : runtime.detail,
      target_shared_dev: false,
      prod_untouched: true,
    },
    null,
    2,
  ),
)

if (!runtime.ok && runtime.detail !== 'skipped_no_local_postgres') {
  process.exitCode = 1
  console.error(runtime.detail)
}
