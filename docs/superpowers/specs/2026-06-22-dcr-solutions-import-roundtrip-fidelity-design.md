# DCR Solutions XML — Import / Round-Trip Fidelity (Design Spec)

**Date:** 2026-06-22
**Status:** Approved for planning
**Sub-project:** #1 of the Tier-1 modeler work (see `DCR_ENGINE_GAP_ANALYSIS.md` §11–§12)
**Branch:** `feature/dcr-solutions-import-fidelity`

## 1. Goal

When a user uploads an existing DCR Solutions `<dcrgraph>` XML, the editor must model it **with zero information loss** and be able to export it back to the same format unchanged. This is the data-layer foundation for later sub-projects (rendering the data, then editing it, then simulating it). It does **not** add UI or engine evaluation.

Today both DCR Solutions importers (`XMLConverter.js`, `DCRPortalConverter`) extract only `id / role / description / included / executed / pending` per event and **silently drop** everything in the gap analysis §12 (event data types, dictionaries, expressions, computations, updates, `coresponse`, timing, groups/tags, outcome HTML, metadata). The native exporter (`DCRXML.js`) emits empty `expressions`/`eventData` scaffolding. This sub-project closes that gap.

## 2. Scope

**In scope:** a lossless data model + import + export round-trip for DCR Solutions XML.

**Out of scope (each a later sub-project):**
- Canvas rendering of data constructs (badges, `coresponse` markers, computed-event styling) — sub-project #2.
- Editing UI for the data — sub-project #3.
- Engine **evaluation** of expressions / timing / computations / DMN — Tier-2 engine work. We *preserve and type* expressions; we never *evaluate* them here.
- DMN decision-table structural editing — DMN rides as opaque carry.

## 3. Approach (chosen)

**Approach 3 — Hybrid: typed semantic bucket + opaque carry.** Type the §12 semantic constructs the engine/editor will use; carry every un-modeled decorative/metadata fragment through verbatim. This equals "fully typed" for everything that matters, with a stronger no-loss guarantee on the long tail and far less schema busywork.

(Rejected: **Approach 1 fully-typed** — types decorative metadata we will never edit, more work for the same near-term result. **Approach 2 opaque-only** — nothing becomes editable typed data, diverges from the model on add/delete, punts the real work.)

## 4. Architecture & data flow

The `dcr:` moddle tree (`viewer._definitions`) is the single source of truth. Everything routes through it.

```
DCR Solutions <dcrgraph> XML
        │  import  (DCRPortalConverter — canonical)
        ▼
   dcr: moddle tree   ←── single source of truth
   (typed §12 data  +  opaque carry)
        │                         │
 saveXML (internal dcr:)    saveDCRXML (DCRXML.js)
        ▼                         ▼
 Supabase persistence      DCR Solutions <dcrgraph> XML
```

Consequences:

1. **Both buckets live in the moddle tree**, attached to business objects (per element) and the graph root, so they survive *both* serializers — internal `saveXML` (what Supabase persists) and `DCRXML.js` (DCR Solutions interop). Carry travels with its element and is deleted with it.
2. **Primary round-trip = DCR Solutions → editor → DCR Solutions** (`DCRPortalConverter` in, `DCRXML.js` out). **Secondary round-trip = `saveXML`→`importXML`** (internal `dcr:`, persistence path) — must preserve the same data.
3. **Consolidate to one importer:** `DCRPortalConverter` becomes the single canonical DCR Solutions importer (it already handles `form`/`templateSpawn`); `XMLConverter.js` is retired/redirected and the app's upload call site is pointed at the canonical path.

## 5. Data model

### 5.1 Bucket 1 — typed (added to `modeler/lib/moddle/resources/dcr.json`)

**On `Event` / `SubProcess`:**
- `eventData` → typed `{ dataType, format, dictionary: [{ label, value }] }`. (`validationRules`, `min/max/placeholder/hinttext` ride in carry.)
- `computation` — string ref to an expression id (computed/Robot events, e.g. `DMN`, `CloseContact`, `FirstPCRTest`).
- `eventDescription` — rich-text outcome HTML, **kept separate from the label**. DCR Solutions has both a `labelMapping` (question text) and an `eventDescription` (HTML body); today's modeler collapses both into `description`. We split: `description` = label/question text, `eventDescription` = HTML body. Required because `label`-type outcome events carry the conclusion text here.
- `groups` (tags incl. `ShowInChatSOP`) and `phases` — string lists.
- Original event `type` (`form` | `subprocess` | `nesting`) preserved so export restores `form` (the fork rewrites `form`→subprocess for rendering).

**On `Relation`:** add `expressionId` (guard), `valueExpressionId` (update value), `time` (timing ref). `coresponse` / `update` / `spawn` survive as `type` values (their rendering/rules are sub-project #2). Carry `link` / `filterLevel` / per-relation `groups`.

**Graph root:** typed `expressions: [{ id, value, type }]` (guards, computations, update value-expressions). Each expression's embedded DMN `<definitions>` rides in carry — the FEEL-like `value` string is the typed source of truth, the DMN tree is its mirror. Plus small `roles` / `groups` / `phases` lists.

### 5.2 Bucket 2 — opaque carry (preserved verbatim, never parsed)

- **Per business object:** an `extensions` property holding un-modeled `custom/*` children (`visualization`/colors, `insight`, `costs`, `level`, `purpose`, `guide`, `eventScope`, `precondition`, `readRoles`, extra roles, `validationRules`, `eventType`, `interfaces`, …).
- **Graph root:** a `graphExtensions` property for top-level sections (`meta`, `revision`, `organization`, `environment`, `custom/graphDetails`, `graphLaw`, `graphGuidelines`, `graphDocumentation`, `highlighterMarkup`, `graphFilters`, `kpis`, `eventTypes`, `eventParameters`, `variables`, `variableAccesses`, …) and the `<dcrgraph>` attributes (`title`, `dataTypesStatus`, `filterLevel`, `zoomLevel`, `graphBG`, `graphType`, `version`, …).
- **Encoding:** carried fragments are opaque XML, embedded in the intermediate `dcr:` XML the importer emits so they survive into the moddle tree and back out of both serializers. Default encoding: CDATA string (robust for the foreign-namespace DMN content). Final encoding choice is the one open implementation detail, to be settled in the plan.

## 6. Import mapping (`DCRPortalConverter`)

Keep its current shape — parse `<dcrgraph>` with xml2js, emit an intermediate `dcr:` XML string, hand to `importXML` — but enrich what it emits:
- Per event/subprocess/nesting: existing structure **plus** Bucket-1 typed fields (`eventData`, `computation`, `eventDescription`, `groups`, `phases`, label from `labelMappings`, original `type`); everything else under `custom/*` → that element's `extensions` carry.
- Constraints: map **all** sections incl. `coresponse` / `update` / `spawn`, carrying `expressionId` / `valueExpressionId` / `time` (and `link` / `filterLevel` into carry).
- Root: `<expressions>` → typed list + each expression's DMN `<definitions>` into carry; `roles` / `groups` / `phases` lists; all un-modeled top-level sections + `<dcrgraph>` attributes → `graphExtensions`.

## 7. Export mapping (`DCRXML.js`)

Walk the moddle tree and rebuild the DCR Solutions `<dcrgraph>`:
- Re-serialize typed Bucket-1 fields into their DCR Solutions shapes (restoring `form` where it was `form`).
- Reconstruct `<constraints>` (incl. `coresponse` / `update` / `spawn`, re-attaching `expressionId` / `valueExpressionId` / `time`).
- Reconstruct `<expressions>` from the typed list, re-embedding carried DMN `<definitions>`.
- Splice per-element + root carry back in.

This replaces the current stubbed empty `expressions` / `eventData`.

## 8. Phasing (within this spec)

- **Phase 1 — semantic mapping (≈ "B"):** schema + importer + exporter for **Bucket 1**; round-trip verified on the semantic constructs. Bucket-2 metadata may still be lossy at this checkpoint.
- **Phase 2 — lossless (→ "A"):** add per-element + root **opaque carry** through schema/importer/exporter; an unedited import→export is semantically identical *including* metadata.

Because the carry is schema-declared on the moddle tree, the internal `saveXML`→`importXML` loop (Supabase) preserves it too — no separate persistence work.

## 9. Acceptance tests

- **Primary round-trip:** for each of `Corona - ChatBot SOP`, `SU (Handicap)`, `DMN chatbot - english` — import via `DCRPortalConverter`, export via `DCRXML.js`, **semantic diff of input vs output is empty** (same structure, data types, dictionaries, expressions, computations, updates, `coresponse`/`spawn`/timing, groups, labels, `eventDescription`, and Phase-2 carried metadata). "Semantic" normalizes cosmetic XML differences (attribute order, whitespace, namespace prefixes) but allows **zero content loss**.
- **Secondary round-trip:** `saveXML`→`importXML` preserves the same typed data + carry.
- **Per-construct unit tests:** fixtures asserting each mapping (a `choice` event with dictionary; an expression with embedded DMN; an `update` with `valueExpressionId`; a `form`-type container restored as `form`; a `coresponse` relation).
- Tests run under the modeler's existing **vitest** suite (`modeler/test/spec/**`). Sample graphs are committed as fixtures.

## 10. Risks / notes

- **Licensing:** the DCR XML format is DCR Solutions IP. We read/round-trip a user-supplied file; we do not redistribute a format spec. Non-blocking note.
- **`label` vs `eventDescription` split** changes how the modeler treats `description`; keep existing label-editing behavior working (regression check on `label-editing` + `moddleToDCR`).
- **Importer consolidation** (retiring `XMLConverter.js`) must update the app upload call site; confirm no other caller uses the old path.
- **Carry encoding** (generic moddle element vs CDATA string) is the one open implementation detail; plan defaults to CDATA string.
- **`moddleToDCR` (engine bridge)** reads `description` as label today; verify the `label`/`eventDescription` split doesn't change the converted engine graph for existing flows.
