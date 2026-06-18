# Supabase Setup

This folder contains the database migrations for the multi-user DCR-js persistence layer.

## Required Frontend Environment

Create `app/.env.local` from `app/.env.example`:

```sh
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

If these variables are absent, the app keeps the previous local in-memory behavior.

Only use the Supabase anon public key in `app/.env.local`. Do not put the service-role key in frontend environment variables.

## Google Auth Setup

The app now uses Supabase Google OAuth instead of app-local email/password
accounts.

In Google Cloud Console:

1. Create a web OAuth client.
2. Add authorized JavaScript origins:

```txt
https://dcr-js-interactive-app.vercel.app
http://localhost:5173
```

3. Add the Supabase Google provider callback URL as an authorized redirect URI:

```txt
https://your-project-ref.supabase.co/auth/v1/callback
```

In Supabase:

1. Go to `Authentication -> Providers -> Google`.
2. Enable Google.
3. Paste the Google OAuth client ID and client secret.
4. Save.

Do not put the Google client secret in this repository, `app/.env.local`, Vercel
environment variables, or chat logs. It belongs only in the Supabase Dashboard.

## Migration

Apply the SQL migrations to a Supabase project in this order:

1. `migrations/20260618160000_initial_persistence.sql`
2. `migrations/20260618183000_allow_google_authenticated_users.sql`
3. `migrations/20260618190000_grant_authenticated_persistence_access.sql`

The migration creates:

- `graphs`
- `graph_versions`
- `journal_entries`
- `modeling_drafts`

It also enables Row Level Security and restricts graph data access to the signed-in user who owns the graph or draft.

The Google-auth migration removes the previous university-email auth trigger and changes the old email-domain helper functions to allow any authenticated user. Existing policy names are kept for compatibility with the initial migration.

The grant migration gives the Supabase `authenticated` role Data API access to the persistence tables. Row Level Security still restricts rows to the owning signed-in user. If the app shows errors such as `Unable to load saved graphs` or `Unable to save graph`, confirm this grant migration has been applied.

The frontend integration persists saved graphs, graph versions, Modeling journal entries for saved graphs, and the user's latest Modeling draft.

The Modeling draft stores the current graph XML, graph name, optional saved graph link, and journal entries. This protects newly created, uploaded, and example-based graphs before the user explicitly saves them as named graphs.

## Verification

After applying all migrations, run `verification/modeling_persistence_checks.sql` in the Supabase SQL editor.

The verification query checks:

- required Modeling persistence tables exist
- Row Level Security is enabled
- expected policies exist
- authenticated table grants exist
- compatibility auth helper functions exist
- the old university-domain auth trigger has been removed
- representative email addresses are accepted by the relaxed helper

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

1. Click `Continue with Google`.
2. Complete Google sign-in.
3. Open Modeling.
4. Create a new graph and add at least one event.
5. Wait for the draft status to show `Draft saved`.
6. Refresh the browser and return to Modeling.
7. Confirm the unsaved draft restores.
8. Save the graph explicitly.
9. Refresh again and confirm the saved graph is available from saved graphs.
10. Open an XML upload or example graph, refresh before saving, and confirm it restores as a draft.

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
http://localhost:5173/dcr-js/**
```

For GitHub Pages or any deployment under `/dcr-js/`, keep:

```sh
VITE_BASE_PATH=/dcr-js/
```
