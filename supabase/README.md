# Supabase Setup

This folder contains the first database migration for the multi-user DCR-js persistence layer.

## Required Frontend Environment

Create `app/.env.local` from `app/.env.example`:

```sh
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

If these variables are absent, the app keeps the previous local in-memory behavior.

Only use the Supabase anon public key in `app/.env.local`. Do not put the service-role key in frontend environment variables.

## Migration

Apply the SQL in `migrations/20260618160000_initial_persistence.sql` to a Supabase project.

The migration creates:

- `graphs`
- `graph_versions`
- `journal_entries`
- `modeling_drafts`

It also enables Row Level Security and restricts graph data access to authenticated users with emails ending in:

- `@ku.dk`
- `@di.ku.dk`
- `@dtu.dk`
- `@jur.ku.dk`

The frontend integration persists saved graphs, graph versions, Modeling journal entries for saved graphs, and the user's latest Modeling draft.

The Modeling draft stores the current graph XML, graph name, optional saved graph link, and journal entries. This protects newly created, uploaded, and example-based graphs before the user explicitly saves them as named graphs.

### Auth Trigger Fallback

The migration includes a trigger on `auth.users` to reject account creation for disallowed email domains at the Auth table boundary.

If your Supabase project does not allow creating triggers on `auth.users` from the SQL editor, use `fallbacks/without_auth_trigger.sql` after applying the rest of the migration.

With that fallback:

- the frontend still blocks disallowed email domains before sign-up/sign-in
- Row Level Security still blocks disallowed email domains from reading or writing Modeling data
- disallowed Supabase Auth accounts may exist, but they cannot access `graphs`, `graph_versions`, `journal_entries`, or `modeling_drafts`
- the verification script will show the auth trigger check as `fail`; all table/RLS/policy/email helper checks should still pass

## Verification

After applying the migration, run `verification/modeling_persistence_checks.sql` in the Supabase SQL editor.

The verification query checks:

- required Modeling persistence tables exist
- Row Level Security is enabled
- expected policies exist
- university email-domain helpers exist
- the auth trigger exists
- allowed and disallowed email domains evaluate as expected

Every returned row should have `result = pass`.

## Local Browser Test

Start the app from the repository root:

```sh
yarn start
```

Open:

```txt
http://localhost:5173/dcr-js
```

Recommended Modeling checks:

1. Sign in or create an account with an allowed email domain.
2. Confirm a disallowed email domain is rejected.
3. Open Modeling.
4. Create a new graph and add at least one event.
5. Wait for the draft status to show `Draft saved`.
6. Refresh the browser and return to Modeling.
7. Confirm the unsaved draft restores.
8. Save the graph explicitly.
9. Refresh again and confirm the saved graph is available from saved graphs.
10. Open an XML upload or example graph, refresh before saving, and confirm it restores as a draft.

For local auth testing, Supabase email confirmation can either be configured with the local site URL:

```txt
http://localhost:5173/dcr-js
```

or temporarily disabled in the Supabase Auth settings while testing.

## Vercel Deployment

Vercel is a good no-payment deployment option for a small prototype on the Hobby plan. Deploy from the repository root, not from `app/`, so the Yarn workspaces for `app`, `modeler`, and `dcr-engine` resolve correctly.

The repository includes `vercel.json` with:

- install command: `yarn install --frozen-lockfile`
- build command: `yarn workspace app predeploy`
- output directory: `app/dist`

In Vercel project settings, add these environment variables:

```sh
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_BASE_PATH=/
```

Use only the Supabase anon public key. Do not use the service-role key.

`VITE_BASE_PATH=/` is important on Vercel because the app is served from the
domain root. The Vite config also detects Vercel and defaults to `/` there, but
setting the variable explicitly keeps the deployment easy to inspect.

In Supabase Auth URL configuration, set the production Site URL to your Vercel production URL, for example:

```txt
https://your-project.vercel.app
```

For Vercel preview deployments, add a redirect URL pattern that matches your preview URLs, for example:

```txt
https://*-your-vercel-account.vercel.app/**
```

Keep the local development redirect URL too:

```txt
http://localhost:5173/dcr-js
```

For GitHub Pages or any deployment under `/dcr-js/`, keep:

```sh
VITE_BASE_PATH=/dcr-js/
```
