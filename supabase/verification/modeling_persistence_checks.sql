with expected_tables(table_name) as (
  values
    ('graphs'),
    ('graph_versions'),
    ('journal_entries'),
    ('modeling_drafts')
),
expected_policies(table_name, policy_name) as (
  values
    ('graphs', 'Allowed users can read own graphs'),
    ('graphs', 'Allowed users can create own graphs'),
    ('graphs', 'Allowed users can update own graphs'),
    ('graphs', 'Allowed users can delete own graphs'),
    ('graph_versions', 'Allowed users can read versions for own graphs'),
    ('graph_versions', 'Allowed users can create versions for own graphs'),
    ('journal_entries', 'Allowed users can read journal for own graphs'),
    ('journal_entries', 'Allowed users can create journal entries for own graphs'),
    ('journal_entries', 'Allowed users can update own journal notes'),
    ('journal_entries', 'Allowed users can delete own journal entries'),
    ('modeling_drafts', 'Allowed users can read own modeling draft'),
    ('modeling_drafts', 'Allowed users can create own modeling draft'),
    ('modeling_drafts', 'Allowed users can update own modeling draft'),
    ('modeling_drafts', 'Allowed users can delete own modeling draft')
),
email_checks(email, expected) as (
  values
    ('alice@ku.dk', true),
    ('alice@di.ku.dk', true),
    ('alice@dtu.dk', true),
    ('alice@jur.ku.dk', true),
    ('alice@example.com', false),
    ('alice@ku.dk.example.com', false)
),
checks as (
  select
    'table exists: ' || expected_tables.table_name as check_name,
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = expected_tables.table_name
    ) as passed
  from expected_tables

  union all

  select
    'rls enabled: ' || expected_tables.table_name as check_name,
    exists (
      select 1
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = expected_tables.table_name
        and pg_class.relrowsecurity
    ) as passed
  from expected_tables

  union all

  select
    'policy exists: ' || expected_policies.table_name || ' / ' || expected_policies.policy_name as check_name,
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = expected_policies.table_name
        and policyname = expected_policies.policy_name
    ) as passed
  from expected_policies

  union all

  select
    'function exists: is_allowed_university_email_address' as check_name,
    exists (
      select 1
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname = 'is_allowed_university_email_address'
    ) as passed

  union all

  select
    'function exists: reject_disallowed_auth_email' as check_name,
    exists (
      select 1
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname = 'reject_disallowed_auth_email'
    ) as passed

  union all

  select
    'auth trigger exists: auth_users_reject_disallowed_email' as check_name,
    exists (
      select 1
      from pg_trigger
      join pg_class on pg_class.oid = pg_trigger.tgrelid
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'auth'
        and pg_class.relname = 'users'
        and pg_trigger.tgname = 'auth_users_reject_disallowed_email'
        and not pg_trigger.tgisinternal
    ) as passed

  union all

  select
    'email domain check: ' || email_checks.email as check_name,
    public.is_allowed_university_email_address(email_checks.email) = email_checks.expected as passed
  from email_checks
)
select
  check_name,
  case when passed then 'pass' else 'fail' end as result
from checks
order by result, check_name;
