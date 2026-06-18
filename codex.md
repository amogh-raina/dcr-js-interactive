# Codex Change Log And Architecture Notes

This document summarizes the changes made during the recent modeling UX work. It is intended as a handoff file: first a high-level walkthrough of what changed, then a code-level map of the files and modules touched.

## High-Level Summary

The work focused on making the Modeling page easier to inspect, explain, and use without changing the underlying DCR graph semantics or export format.

The main additions are:

- Supabase-backed authentication and saved graph persistence.
- A Modeling side panel with `Details` and `Journal` tabs.
- A selection inspector for events, subprocesses, nestings, and relations.
- Canvas focus mode that dims unrelated graph elements when something is selected.
- Relation visibility toggles for the selected element.
- A session-only journal that records important graph edits and lets users attach notes.
- A notebook icon that opens the journal even when nothing is selected.
- A larger, labeled, visually clearer left palette.
- Edge-drag quick relation creation for events, subprocesses, and nestings.
- A small DCR Solutions XML import fix for form-like subprocess containers.

The changes are additive. Existing import/export, direct label editing, context-pad actions, simulation, conformance, discovery, and log generation behavior were not intentionally changed.

## Supabase Auth And Persistence

The app now has a first Supabase integration for multi-user persistence. When Supabase environment variables are configured, the app requires sign-in before showing the DCR-js states. When the variables are absent, the app keeps the previous local in-memory behavior so existing development workflows still run.

Created:

- `app/src/supabase/client.ts`
- `app/src/supabase/graphs.ts`
- `app/src/components/AuthGate.tsx`
- `app/src/components/AuthStatus.tsx`
- `app/src/vite-env.d.ts`
- `app/.env.example`
- `supabase/migrations/20260618160000_initial_persistence.sql`
- `supabase/README.md`

Updated:

- `app/src/App.tsx`
- `app/src/components/ModelerState.tsx`
- `app/src/components/DiscoveryState.tsx`
- `app/src/components/ConformanceCheckingState.tsx`
- `app/package.json`
- `yarn.lock`

Purpose:

- Add the official Supabase JavaScript client dependency.
- Gate the app behind Supabase Auth when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured.
- The original implementation restricted login/data access to university-affiliated email domains. That has since been replaced by Google OAuth for any signed-in Google user.
- Load saved graphs from the `graphs` table after sign-in.
- Save graphs to Postgres through Supabase instead of only saving to an in-memory `Map`.
- Create a `graph_versions` row for each graph save.
- Keep existing local behavior as a fallback when Supabase is not configured.

Key implementation details:

- `AuthGate.tsx` now provides a Google OAuth sign-in screen.
- `AuthStatus.tsx` shows the signed-in email and a sign-out button.
- `client.ts` centralizes Supabase setup.
- `graphs.ts` handles graph loading and graph saving.
- `App.tsx` now owns Supabase session loading, auth-state subscriptions, remote graph loading, and async graph saving.
- `StateProps.saveGraph` now returns `Promise<DCRGraphEntry | null>` because database persistence is asynchronous and callers may need the saved graph id.
- Existing save callers in Modeling, Discovery, and Conformance were updated to await the async save where the result matters.
- `supabase/migrations/20260618160000_initial_persistence.sql` creates:
  - `graphs`
  - `graph_versions`
  - `journal_entries`
- The initial migration enables Row Level Security and included server-side email-domain checks; the later Google-auth migration relaxes those helpers to authenticated-user checks.
- The migration prepares a journal table, but the journal UI is not yet wired to persist entries in Supabase.

Current Supabase persistence scope:

- Saved graphs persist across refresh and devices for the signed-in user.
- Graph versions are recorded on each save.
- Modeling journal entries persist for saved graphs.
- The latest Modeling draft is autosaved for the signed-in user, including unsaved graph XML, graph name, optional saved graph id, and journal entries.
- Unsaved graph journals are stored in the Modeling draft until the first successful save creates a database graph id.
- Simulation, discovery, conformance, and event-log generation persistence are intentionally out of scope for the current backend pass.
- Event logs are still kept in frontend memory.
- Shared graph membership and real-time collaboration are not implemented yet.

Scope clarification:

- Backend work is currently focused on the Modeling layer only.
- A brief event-log persistence expansion was started and then removed after the scope was clarified.
- The Supabase migration should therefore contain graph, graph version, and modeling journal tables only.

Additional journal persistence update:

- `app/src/supabase/journal.ts` was added to load, upsert, update, and delete journal entries in Supabase.
- `supabase/migrations/20260618160000_initial_persistence.sql` now stores journal `client_id`, `title`, and `user_created` so the existing Modeling journal UI can round-trip through Postgres without changing React keys.
- `app/src/components/ModelerState.tsx` now loads remote journal entries for saved graphs, debounces journal upserts while a saved graph is open, persists notes when edited, deletes user-created notes remotely, and flushes local journal entries immediately after a first successful save.
- `app/src/components/Examples.tsx` now passes the selected example name into the modeler open flow, and `ModelerState.open(...)` now strips file extensions more safely. This gives graphs started from examples useful names when saved.
- `app/src/components/ModelerState.tsx` now explicitly manages graph identity when opening diagrams: saved graph opens call `setCurrentGraph(name)`, while new diagrams, uploads, and examples call `setCurrentGraph(null)` until the user saves. This prevents journal sync from accidentally writing a new/imported graph's journal entries to a previously selected saved graph.

Modeling draft autosave update:

- `supabase/migrations/20260618160000_initial_persistence.sql` now creates `modeling_drafts`, a per-user draft row for the Modeling page.
- `app/src/supabase/modelingDrafts.ts` was added to load and save the current Modeling draft through Supabase.
- `app/src/components/ModelerState.tsx` now restores the latest Modeling draft when no saved graph is selected, before falling back to the empty board.
- `app/src/components/ModelerState.tsx` now autosaves graph XML, graph name, optional saved graph id, and journal entries after Modeling changes.
- BPMN imports now follow the same saved/unsaved graph identity rule as XML uploads and examples: they clear `currentGraph` before conversion so the converted graph is treated as unsaved until explicitly saved.
- `app/src/components/ModelerState.tsx` now shows a small Modeling draft autosave status indicator when Supabase is configured: `Saving draft...`, `Draft saved`, or `Draft save failed`.
- Draft Row Level Security restricts each user to their own draft and only allows the draft to reference one of that user's saved graphs.

Supabase verification update:

- `supabase/verification/modeling_persistence_checks.sql` was added as a read-only SQL verification script for a real Supabase project after applying the migration.
- `supabase/README.md` now documents how to configure frontend env vars, apply the migration, run the verification script, and manually test Modeling persistence in the browser.
- The verification script checks Modeling persistence tables, RLS enablement, expected policies, compatibility auth helper functions, and that the old auth email trigger has been removed.
- `supabase/fallbacks/without_auth_trigger.sql` was added for the original university-domain setup. It is retained for history but is no longer part of the current Google-auth path.

Supabase environment placement correction:

- The local Supabase credential file should be `app/.env.local`, next to `app/package.json` and `app/vite.config.ts`.
- A mistakenly placed `app/src/.env.local` file was moved to `app/.env.local` without reading or printing its contents.
- `app/.env.example` remains the template file to copy from.

Google auth update:

- `app/src/components/AuthGate.tsx` now uses Supabase Google OAuth through `signInWithOAuth({ provider: "google" })`.
- The email/password sign-in and create-account form was removed from the app UI.
- `app/src/App.tsx` no longer rejects sessions based on university email domains.
- `app/src/supabase/client.ts` no longer exports university-domain allowlist helpers.
- `supabase/migrations/20260618183000_allow_google_authenticated_users.sql` was added to remove the old `auth.users` university-domain trigger and relax the compatibility helper functions so existing RLS policies allow any signed-in user.
- `supabase/verification/modeling_persistence_checks.sql` was updated to expect the old auth trigger to be removed and representative emails to be accepted.
- `supabase/README.md` now documents Google Cloud OAuth client setup, Supabase Google provider setup, and the required migration order.
- The Supabase CLI was not installed in this environment, so the new migration file was added manually under the existing timestamped migration convention.

Deployment configuration update:

- `app/vite.config.ts` now reads `VITE_BASE_PATH`, defaulting to `/dcr-js/`.
- `app/src/utilComponents/basePath.ts` was added to build public asset URLs from Vite's configured base path.
- Hard-coded `/dcr-js/...` asset/fetch URLs in Modeling examples, home icons, and BPMN conversion loading were switched to `basePath(...)`.
- `vercel.json` was added at the repository root so Vercel can install the workspace dependencies, build `app`, and publish `app/dist`.
- `app/.env.example` now includes `VITE_BASE_PATH=/dcr-js/`.
- `supabase/README.md` now includes Vercel deployment environment variables and Supabase Auth URL/redirect guidance.
- `app/vite.config.ts` now detects Vercel through the `VERCEL` environment variable and defaults the base path to `/` on Vercel. This prevents blank deployments when `VITE_BASE_PATH=/` was not explicitly configured.
- `supabase/README.md` now explains why `VITE_BASE_PATH=/` is needed for Vercel root-domain deployments.

Git hygiene update:

- `app/src/supabase/` was reviewed and is safe to keep in Git because it contains source modules only. It reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the environment and does not contain project credentials.
- `supabase/` was reviewed and is safe to keep in Git because it contains migrations, verification SQL, fallback SQL, and documentation only.
- Real credentials belong in `app/.env.local`; that file is ignored and should not be committed.
- `.gitignore` now explicitly ignores generated app build output at `app/dist/` and temporary diagnostics at `tmp/`.

## Modeling Side Panel

The Modeling page now has a right-side panel that can show either selection details or the session journal.

The panel is shown when:

- a graph element or relation is selected, or
- the user clicks the notebook icon in the top-right toolbar.

The `Details` tab hosts the selection inspector. The `Journal` tab hosts the session change log.

Created:

- `app/src/components/ModelingSidePanel.tsx`

Purpose:

- Provides the reusable fixed right-side panel shell.
- Owns the `Details` / `Journal` tab UI.
- Keeps panel layout separate from the selection and journal content.

Integrated in:

- `app/src/components/ModelerState.tsx`

## Selection Inspector And Focus Mode

Selecting an event, subprocess, nesting, or relation now opens the `Details` tab. The inspector shows plain-language information about the selected item.

For events, subprocesses, and nestings it supports:

- viewing the selected element type and label
- editing `description`
- editing `role` where supported
- listing direct incoming and outgoing relations
- selecting a relation from the relation list
- toggling visible relation categories for the focused element

Relation type editing remains in the existing context-pad popup. The inspector relation list is read-only except for row selection and visibility filtering.

Created:

- `app/src/components/SelectionInspector.tsx`

Purpose:

- Reads the selected element from the modeler element registry.
- Displays editable element metadata.
- Calls `modeling.updateProperties` only for explicit user edits.
- Lists incoming/outgoing relations with source, target, direction, and type.
- Exposes relation category toggles for `condition`, `response`, `include`, `exclude`, `milestone`, and `spawn`.

Updated:

- `app/src/components/ModelerState.tsx`
- `modeler/lib/BaseViewer.js`
- `app/src/@types/modeler.d.ts`
- `app/src/index.css`

Key implementation details:

- `ModelerState` listens to `selection.changed` through `ReactiveModeler`.
- `BaseViewer` exposes `setFocusFilter(filter | null)`.
- Focus styling is implemented with diagram-js canvas markers:
  - `dcr-focus`
  - `dcr-context`
  - `dcr-dimmed`
  - `dcr-hidden`
- The focus layer is visual only. It does not write semantic XML properties.
- `app/src/index.css` defines the marker styling for dimming, highlighting, and hiding.

## Session Journal

The Modeling page now has a session-only journal. It records important modeling edits during the current browser session and lets the user add notes.

The journal records:

- graph opened
- event, subprocess, and nesting creation
- event, subprocess, and nesting deletion
- relation creation
- relation deletion
- description changes
- role changes
- marking changes such as `included`, `executed`, and `pending`
- relation type changes
- label edits from double-click rename

The journal intentionally ignores visual-only activity:

- pan
- zoom
- element moves
- connection waypoint/layout changes

Created:

- `app/src/components/SessionJournal.tsx`
- `app/src/components/sessionJournalMapper.ts`

Purpose of `SessionJournal.tsx`:

- Renders the journal UI.
- Shows timestamp, title, summary, and editable note field for each entry.
- Provides a `New note` action for free-form session notes.
- Allows clearing notes on entries.
- Allows deleting user-created free-form notes.

Purpose of `sessionJournalMapper.ts`:

- Converts diagram-js command stack events into stable journal entries.
- Filters out noisy commands.
- Produces human-readable summaries.

Integrated in:

- `app/src/components/ModelerState.tsx`

Key implementation details:

- Journal state is kept only in React state inside `ModelerState`.
- Nothing is persisted to local storage.
- Nothing is saved into DCR XML or export formats.
- Opening/importing/starting a graph clears the previous session journal and adds an `Opened graph` entry.
- The notebook icon uses `BiNotepad` and opens the `Journal` tab.

## Palette Improvements

The left-side diagram palette was made larger and clearer. Palette entries now show both an icon and a label rather than icon-only entries.

Updated:

- `modeler/lib/features/palette/PaletteProvider.js`
- `app/src/assets/odm.css`

Changes:

- Palette entries now use custom HTML with:
  - icon span
  - text label span
- Added labels such as:
  - `Hand`
  - `Select`
  - `Space`
  - `Event`
  - `Relation`
  - `Subprocess`
  - `Nesting`
- Increased palette width and entry height.
- Added visual styling that better matches the canvas theme:
  - border
  - subtle shadow
  - hover state
  - active/highlight state
  - clearer spacing

## Quick Relation Creation

Relation creation was made easier by allowing users to start a relation by dragging from the edge of an event, subprocess, or nesting.

Created:

- `modeler/lib/features/quick-connect/QuickConnect.js`
- `modeler/lib/features/quick-connect/index.js`

Updated:

- `modeler/lib/Modeler.js`
- `app/src/index.css`

Purpose:

- Adds a lightweight modeler module that listens for edge hover and mouse down events.
- If the pointer is near the edge of a connectable DCR element, it starts diagram-js connection creation.
- This reduces reliance on clicking the relation icon on each node.

Key implementation details:

- Connectable sources are:
  - `dcr:Event`
  - `dcr:Nesting`
  - `dcr:SubProcess`
- The edge activation zone is defined by `EDGE_DRAG_SIZE`.
- A `dcr-quick-connect-source` marker is added while hovering near a connectable edge.
- CSS adds a crosshair cursor and dashed outline for the quick-connect source.
- Existing relation creation through the palette and context pad remains available.

## DCR Solutions XML Import Fix

One imported DCR Solutions XML graph failed because the converter expected only `subprocess` container event types, while the uploaded graph contained a `form` type that behaved like a subprocess/form container.

Updated:

- `modeler/lib/DCRPortalConverter`

Change:

- `handleEvent` now treats `event.$.type === "form"` the same as `event.$.type === "subprocess"` for container conversion.

Purpose:

- Prevents parser failure when DCR Solutions XML uses `form` for a subprocess-like container.

## Main State Wiring

Most feature orchestration lives in:

- `app/src/components/ModelerState.tsx`

This file now coordinates:

- selected element id
- relation visibility toggle state
- inspector refresh state
- side panel active tab
- session journal entries
- focus filter updates
- journal command-stack event subscriptions
- journal reset on graph open/import/init
- top-right notebook icon state

Important modeler event flows:

- Selection changes update `selectedElementId` and open the `Details` tab.
- Relation visibility changes call `modeler.setFocusFilter(...)`.
- Command stack events are mapped through `mapCommandToJournalDraft(...)`.
- Open/import/init graph actions call `resetJournal(...)`.

## Type Definition Updates

Updated:

- `app/src/@types/modeler.d.ts`

Change:

- Added the `setFocusFilter(filter | null)` method to the DCR modeler type definition.

Purpose:

- Lets TypeScript understand the new visual focus API exposed by `BaseViewer`.

## CSS And Visual Marker Changes

Updated:

- `app/src/index.css`
- `app/src/assets/odm.css`

Added marker styles:

- `dcr-quick-connect-source`
- `dcr-focus`
- `dcr-context`
- `dcr-dimmed`
- `dcr-hidden`

These styles affect only canvas presentation. They do not change graph semantics.

## Verification Performed

The app build/predeploy command was run:

```sh
yarn workspace app predeploy
```

Result:

- Build completed successfully.
- Vite emitted only the existing large chunk warning.

Manual browser regression checks are still recommended for:

- selection inspector behavior
- journal entry creation
- note editing/deleting
- quick relation creation from node edges
- relation visibility toggles
- DCR Solutions XML import
- simulation/conformance/discovery/log generation pages

## Current Scope And Known Defaults

The current implementation is intentionally limited to the Modeling page.

Session journal defaults:

- stored in browser memory until the graph has a Supabase id
- synced to Supabase for saved graphs when Supabase is configured
- cleared when a graph is opened/imported/initialized
- not saved into XML
- not exported
- no local storage
- no LLM or RAG integration

Inspector/focus defaults:

- dims unrelated elements instead of hiding them
- hides only selected-element relations disabled by relation type toggles
- uses visual markers/classes only
- keeps existing context-pad editing workflows unchanged

## File-Level Change Log

| File | Change |
| --- | --- |
| `app/src/App.tsx` | Added Supabase auth session handling, sign-in gating, remote graph loading, async graph saving, graph version creation through the Supabase graph service, and signed-in status rendering. |
| `app/src/supabase/client.ts` | New Supabase client/config module. The original university-domain helpers were removed when the app moved to Google OAuth. |
| `app/src/supabase/graphs.ts` | New graph persistence service for loading saved graphs and saving graph XML to Supabase/Postgres. |
| `app/src/supabase/journal.ts` | New journal persistence service for loading, upserting, updating, and deleting Modeling journal entries in Supabase/Postgres. |
| `app/src/supabase/modelingDrafts.ts` | New Modeling draft persistence service for loading and autosaving the signed-in user's latest graph XML, graph name, saved graph link, and journal entries. |
| `app/src/components/AuthGate.tsx` | New sign-in/create-account UI for Supabase Auth. |
| `app/src/components/AuthStatus.tsx` | New signed-in status/sign-out control. |
| `app/src/vite-env.d.ts` | New Vite environment typings for Supabase variables. |
| `app/.env.example` | New example environment file for Supabase URL and anon key. |
| `.gitignore` | Added explicit ignores for `app/dist/` build output and `tmp/` diagnostics. |
| `app/vite.config.ts` | Updated Vite base path configuration to use `VITE_BASE_PATH`, defaulting to `/dcr-js/` normally and `/` on Vercel. |
| `app/src/utilComponents/basePath.ts` | New helper for generating public asset URLs that work under both `/dcr-js/` and root deployments such as Vercel. |
| `vercel.json` | New Vercel deployment config for the monorepo root, building `app` and publishing `app/dist`. |
| `supabase/migrations/20260618160000_initial_persistence.sql` | New database migration for graph persistence, graph versions, journal entries, modeling drafts, Row Level Security, and the original university-email enforcement. |
| `supabase/migrations/20260618183000_allow_google_authenticated_users.sql` | New migration that removes the university-email auth trigger and changes the compatibility auth helper functions to allow any authenticated user. |
| `supabase/README.md` | New setup note for configuring frontend env vars, applying the Supabase migration, running verification SQL, and manually testing Modeling persistence. |
| `supabase/fallbacks/without_auth_trigger.sql` | New fallback SQL for Supabase projects where the optional auth-users email-domain trigger cannot be installed. |
| `supabase/verification/modeling_persistence_checks.sql` | New read-only verification query for confirming the Supabase Modeling persistence migration was applied correctly. |
| `app/package.json` | Added `@supabase/supabase-js`. |
| `yarn.lock` | Updated dependency lockfile for the Supabase client package and transitive packages. |
| `app/src/components/DiscoveryState.tsx` | Updated graph save flow to await async graph persistence. |
| `app/src/components/ConformanceCheckingState.tsx` | Updated uploaded graph save calls to await async graph persistence. |
| `app/src/components/Examples.tsx` | Updated example opening callbacks to pass the example name into the modeler open flow. |
| `app/src/components/ModelerState.tsx` | Added side panel state, selection tracking, focus filter wiring, journal state, journal command subscriptions, journal reset flow, notebook toolbar icon, async graph save handling, example-name handling, explicit current-graph identity handling for saved vs unsaved opens including BPMN conversion, Supabase journal sync for saved graphs, Supabase Modeling draft autosave/restore, and a draft autosave status indicator. |
| `app/src/components/ModelingSidePanel.tsx` | New reusable right-side panel with `Details` and `Journal` tabs. |
| `app/src/components/SelectionInspector.tsx` | New inspector content for selected DCR elements and relations, including editable description/role and relation visibility toggles. |
| `app/src/components/SessionJournal.tsx` | New session journal UI with change entries, timestamps, editable notes, and free-form notes. |
| `app/src/components/sessionJournalMapper.ts` | New mapper that converts command stack events into human-readable journal entries. |
| `modeler/lib/BaseViewer.js` | Added `setFocusFilter` visual focus API and marker application logic. |
| `app/src/@types/modeler.d.ts` | Added TypeScript declaration for `setFocusFilter`. |
| `app/src/index.css` | Added quick-connect and focus marker styles. |
| `app/src/assets/odm.css` | Restyled and enlarged the diagram palette. |
| `modeler/lib/features/palette/PaletteProvider.js` | Added labeled palette entry HTML for tools and DCR elements. |
| `modeler/lib/features/quick-connect/QuickConnect.js` | New edge-drag relation creation behavior. |
| `modeler/lib/features/quick-connect/index.js` | New quick-connect module registration. |
| `modeler/lib/Modeler.js` | Registered the quick-connect module with the modeler. |
| `modeler/lib/DCRPortalConverter` | Treated DCR Solutions `form` events as subprocess/form containers during XML conversion. |
