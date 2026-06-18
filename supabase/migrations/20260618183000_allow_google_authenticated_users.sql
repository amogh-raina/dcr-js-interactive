drop trigger if exists auth_users_reject_disallowed_email on auth.users;

create or replace function public.is_allowed_university_email_address(email text)
returns boolean
language sql
stable
as $$
  select email is not null;
$$;

create or replace function public.is_allowed_university_email()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null;
$$;
