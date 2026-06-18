create extension if not exists pgcrypto;

create or replace function public.is_allowed_university_email_address(email text)
returns boolean
language sql
stable
as $$
  select lower(coalesce(email, '')) like '%@ku.dk'
    or lower(coalesce(email, '')) like '%@di.ku.dk'
    or lower(coalesce(email, '')) like '%@dtu.dk'
    or lower(coalesce(email, '')) like '%@jur.ku.dk';
$$;

create or replace function public.is_allowed_university_email()
returns boolean
language sql
stable
as $$
  select public.is_allowed_university_email_address(auth.jwt() ->> 'email');
$$;

create or replace function public.reject_disallowed_auth_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_allowed_university_email_address(new.email) then
    raise exception 'Only approved university emails can access this application.';
  end if;

  return new;
end;
$$;

create trigger auth_users_reject_disallowed_email
before insert or update of email on auth.users
for each row
execute function public.reject_disallowed_auth_email();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.graphs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  xml text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create trigger graphs_set_updated_at
before update on public.graphs
for each row
execute function public.set_updated_at();

create table public.graph_versions (
  id uuid primary key default gen_random_uuid(),
  graph_id uuid not null references public.graphs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  xml text not null,
  summary text,
  created_at timestamptz not null default now()
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  graph_id uuid not null references public.graphs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  change_type text not null,
  title text not null,
  element_id text,
  element_type text,
  summary text not null,
  note text not null default '',
  user_created boolean not null default false,
  created_at timestamptz not null default now(),
  unique (graph_id, client_id)
);

create table public.modeling_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  graph_id uuid references public.graphs(id) on delete set null,
  graph_name text not null,
  xml text not null,
  journal_entries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger modeling_drafts_set_updated_at
before update on public.modeling_drafts
for each row
execute function public.set_updated_at();

alter table public.graphs enable row level security;
alter table public.graph_versions enable row level security;
alter table public.journal_entries enable row level security;
alter table public.modeling_drafts enable row level security;

create policy "Allowed users can read own graphs"
on public.graphs
for select
to authenticated
using (
  owner_id = auth.uid()
  and public.is_allowed_university_email()
);

create policy "Allowed users can create own graphs"
on public.graphs
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and public.is_allowed_university_email()
);

create policy "Allowed users can update own graphs"
on public.graphs
for update
to authenticated
using (
  owner_id = auth.uid()
  and public.is_allowed_university_email()
)
with check (
  owner_id = auth.uid()
  and public.is_allowed_university_email()
);

create policy "Allowed users can delete own graphs"
on public.graphs
for delete
to authenticated
using (
  owner_id = auth.uid()
  and public.is_allowed_university_email()
);

create policy "Allowed users can read versions for own graphs"
on public.graph_versions
for select
to authenticated
using (
  public.is_allowed_university_email()
  and exists (
    select 1
    from public.graphs
    where graphs.id = graph_versions.graph_id
      and graphs.owner_id = auth.uid()
  )
);

create policy "Allowed users can create versions for own graphs"
on public.graph_versions
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_allowed_university_email()
  and exists (
    select 1
    from public.graphs
    where graphs.id = graph_versions.graph_id
      and graphs.owner_id = auth.uid()
  )
);

create policy "Allowed users can read journal for own graphs"
on public.journal_entries
for select
to authenticated
using (
  public.is_allowed_university_email()
  and exists (
    select 1
    from public.graphs
    where graphs.id = journal_entries.graph_id
      and graphs.owner_id = auth.uid()
  )
);

create policy "Allowed users can create journal entries for own graphs"
on public.journal_entries
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_allowed_university_email()
  and exists (
    select 1
    from public.graphs
    where graphs.id = journal_entries.graph_id
      and graphs.owner_id = auth.uid()
  )
);

create policy "Allowed users can update own journal notes"
on public.journal_entries
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_allowed_university_email()
)
with check (
  user_id = auth.uid()
  and public.is_allowed_university_email()
);

create policy "Allowed users can delete own journal entries"
on public.journal_entries
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_allowed_university_email()
);

create policy "Allowed users can read own modeling draft"
on public.modeling_drafts
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_allowed_university_email()
);

create policy "Allowed users can create own modeling draft"
on public.modeling_drafts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_allowed_university_email()
  and (
    graph_id is null
    or exists (
      select 1
      from public.graphs
      where graphs.id = modeling_drafts.graph_id
        and graphs.owner_id = auth.uid()
    )
  )
);

create policy "Allowed users can update own modeling draft"
on public.modeling_drafts
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_allowed_university_email()
)
with check (
  user_id = auth.uid()
  and public.is_allowed_university_email()
  and (
    graph_id is null
    or exists (
      select 1
      from public.graphs
      where graphs.id = modeling_drafts.graph_id
        and graphs.owner_id = auth.uid()
    )
  )
);

create policy "Allowed users can delete own modeling draft"
on public.modeling_drafts
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_allowed_university_email()
);
