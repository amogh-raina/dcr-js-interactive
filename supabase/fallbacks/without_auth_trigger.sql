-- Use this fallback only if your Supabase project does not allow creating
-- triggers on auth.users from the SQL editor.
--
-- The frontend and all Row Level Security policies still enforce the allowed
-- email domains before graph/modeling data can be read or written. Without the
-- auth.users trigger, disallowed accounts may be created in Supabase Auth, but
-- they cannot access the Modeling persistence tables.

drop trigger if exists auth_users_reject_disallowed_email on auth.users;

drop function if exists public.reject_disallowed_auth_email();
