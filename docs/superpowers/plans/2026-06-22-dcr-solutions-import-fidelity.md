# DCR Solutions XML Import/Round-Trip Fidelity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the modeler import a DCR Solutions `<dcrgraph>` XML with zero information loss and export it back unchanged, by carrying every construct through the `dcr:` moddle tree (typed for the §12 semantic bucket, opaque pass-through for the decorative bucket).

**Architecture:** The `dcr:` moddle tree (`viewer._definitions`) is the single source of truth. `DCRPortalConverter` (import) maps DCR Solutions XML → an intermediate `dcr:` XML string → `importXML` → moddle tree. `DCRXML.js` (export) maps the moddle tree → DCR Solutions XML. New data is declared in the moddle schema so it survives both this round-trip and the internal `saveXML`→`importXML` loop used by Supabase.

**Tech Stack:** Plain ESM JavaScript, `diagram-js`/`moddle`/`moddle-xml`, `xml2js` (in the converters), `vitest` + `happy-dom` (modeler test suite).

## Global Constraints

- Engine/editor **never evaluates** expressions/computations/DMN/timing in this sub-project — preserve and type only. No simulation, no rendering, no editing UI.
- Carry encoding: un-modeled fragments are preserved as **serialized XML strings stored in a moddle body-text element** (`dcr:extensions` per element, `dcr:graphExtensions` on the graph). Chosen for robustness with foreign-namespace DMN content.
- Acceptance = **semantic** equality (normalize attribute order, whitespace, namespace prefixes; numbers compared numerically) with **zero content loss** — not byte equality.
- The three real graphs are the fixtures and the acceptance corpus: `Corona - ChatBot SOP`, `SU (Handicap)`, `DMN chatbot - english`.
- Tests live under `modeler/test/spec/**` and run via `yarn workspace modeler test`.
- Follow existing converter style (xml2js object building; `parentMap`; `dcr:`-prefixed keys). Do not restructure the editor core.

---

## File Structure

- `modeler/lib/moddle/resources/dcr.json` — extend schema: typed Bucket-1 properties + `Expression` type + `expressions` list + carry holders.
- `modeler/lib/DCRPortalConverter` — enrich import to populate typed fields + carry.
- `modeler/lib/DCRXML.js` — rewrite export to emit typed fields + splice carry.
- `modeler/lib/BaseViewer.js` — consolidation: route `importCustomXML` through `DCRPortalConverter`.
- `app/src/components/Examples.tsx` — drop the `<?xml` dispatch heuristic (single import path).
- `modeler/test/fixtures/dcrsolutions/` — the three real graphs (`corona.xml`, `su.xml`, `dmn.xml`).
- `modeler/test/helper/roundTrip.js` — round-trip driver + normalized semantic-diff helper.
- `modeler/test/spec/dcr-fidelity.spec.js` — per-construct + full round-trip tests.
- Delete `modeler/lib/XMLConverter.js` (final consolidation task).

---

### Task 1: Test harness — fixtures, round-trip driver, semantic diff

**Files:**
- Create: `modeler/test/fixtures/dcrsolutions/corona.xml`, `su.xml`, `dmn.xml` (paste the three provided graphs verbatim)
- Create: `modeler/test/helper/roundTrip.js`
- Create: `modeler/test/spec/dcr-fidelity.spec.js`
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Produces:
  - `importDcrSolutions(modeler, xml): Promise<void>` — imports DCR Solutions XML via `modeler.importDCRPortalXML`.
  - `exportDcrSolutions(modeler): Promise<string>` — returns DCR Solutions XML via `modeler.saveDCRXML()`.
  - `parseDcr(xml): object` — xml2js parse to a plain object (async-free wrapper using `parseStringPromise`).
  - `collectEventIds(parsedDcr): string[]` — recursively all `event/@id` (incl. nested).
  - `collectRelations(parsedDcr): Array<{section,sourceId,targetId,...attrs}>` — all constraint rows across every `<constraints>` child section.

- [ ] **Step 1: Add the three fixtures**

Copy the three provided XML documents verbatim into `modeler/test/fixtures/dcrsolutions/corona.xml`, `su.xml`, `dmn.xml`.

- [ ] **Step 2: Write the round-trip helper**

```js
// modeler/test/helper/roundTrip.js
import { parseStringPromise } from 'xml2js';
import Modeler from '/lib/Modeler';

export function createModeler() {
  const container = document.createElement('div');
  return new Modeler({ container, keyboard: { bindTo: document } });
}

export async function importDcrSolutions(modeler, xml) {
  return modeler.importDCRPortalXML(xml);
}

export async function exportDcrSolutions(modeler) {
  const { xml } = await modeler.saveDCRXML();
  return xml;
}

export async function parseDcr(xml) {
  return parseStringPromise(xml);
}

export function collectEventIds(parsed) {
  const ids = [];
  const walk = (ev) => {
    if (!ev) return;
    if (ev.$ && ev.$.id) ids.push(ev.$.id);
    (ev.event || []).forEach(walk);
  };
  const events = parsed.dcrgraph.specification[0].resources[0].events[0].event || [];
  events.forEach(walk);
  return ids.sort();
}

export function collectRelations(parsed) {
  const out = [];
  const cons = parsed.dcrgraph.specification[0].constraints[0];
  for (const section of Object.keys(cons)) {
    const rows = cons[section];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      for (const relKey of Object.keys(row)) {
        for (const rel of (row[relKey] || [])) {
          if (rel && rel.$) out.push({ section, ...rel.$ });
        }
      }
    }
  }
  return out;
}
```

- [ ] **Step 3: Write the baseline round-trip test (documents current structural pass + current data loss)**

```js
// modeler/test/spec/dcr-fidelity.spec.js
import { it, expect, describe } from 'vitest';
import coronaXML from '../fixtures/dcrsolutions/corona.xml?raw';
import suXML from '../fixtures/dcrsolutions/su.xml?raw';
import dmnXML from '../fixtures/dcrsolutions/dmn.xml?raw';
import {
  createModeler, importDcrSolutions, exportDcrSolutions, parseDcr, collectEventIds,
} from '../helper/roundTrip';

describe('DCR Solutions round-trip', () => {
  it('preserves all event ids (structure) for corona', async () => {
    const modeler = createModeler();
    await importDcrSolutions(modeler, coronaXML);
    const out = await exportDcrSolutions(modeler);
    const before = collectEventIds(await parseDcr(coronaXML));
    const after = collectEventIds(await parseDcr(out));
    expect(after).toEqual(before);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: the structure test PASSES (event ids round-trip); if it fails, fix `collectEventIds` traversal before proceeding. This task only establishes the harness.

- [ ] **Step 5: Commit**

```bash
git add modeler/test/fixtures/dcrsolutions modeler/test/helper/roundTrip.js modeler/test/spec/dcr-fidelity.spec.js
git commit -m "test: add DCR Solutions round-trip harness and fixtures"
```

---

### Task 2: Extend the moddle schema (typed Bucket-1 + carry holders)

**Files:**
- Modify: `modeler/lib/moddle/resources/dcr.json`
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Produces (new moddle properties, all optional so existing graphs still parse):
  - `Event`/`SubProcess`: `dataType:String`, `dataFormat:String`, `dictionaryItems:DictionaryItem[]`, `computation:String`, `eventDescription:String`, `groups:String` (comma-joined), `phases:String` (comma-joined), `originalType:String`, `extensions:Extensions`.
  - `Relation`: `expressionId:String`, `valueExpressionId:String`, `time:String`, `extensions:Extensions`.
  - New types: `DictionaryItem { label:String(attr), value:String(attr) }`; `Expression { id:String(attr,isId), value:String(attr), exprType:String(attr, xml name "type"), definitionsXml -> body of nested Extensions }`; `Extensions { content:String(isBody) }`.
  - `DcrGraph`: `expressions:Expression[]`, `roles:String`, `groups:String`, `phases:String`, `graphExtensions:Extensions`.

- [ ] **Step 1: Write the failing schema round-trip test**

```js
// append to dcr-fidelity.spec.js
import Modeler from '/lib/Modeler';

it('moddle preserves new typed attrs through importXML→saveXML', async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<dcr:definitions xmlns:dcr="http://tk/schema/dcr" xmlns:dcrDi="http://tk/schema/dcrDi" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC">
  <dcr:dcrGraph id="Graph">
    <dcr:event id="E1" description="" dataType="choice" dataFormat="string" computation="" included="true" executed="false" pending="false">
      <dcr:dictionaryItems label="Yes" value="1" />
      <dcr:dictionaryItems label="No" value="0" />
    </dcr:event>
  </dcr:dcrGraph>
  <dcrDi:dcrRootBoard id="RB"><dcrDi:dcrPlane id="P" boardElement="Graph">
    <dcrDi:dcrShape id="E1_di" boardElement="E1"><dc:Bounds x="0" y="0" width="130" height="150" /></dcrDi:dcrShape>
  </dcrDi:dcrPlane></dcrDi:dcrRootBoard>
</dcr:definitions>`;
  const modeler = new Modeler({ container: document.createElement('div') });
  await modeler.importXML(xml);
  const out = (await modeler.saveXML({ format: false })).xml;
  expect(out).toContain('dataType="choice"');
  expect(out).toContain('label="Yes"');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: FAIL — `dataType`/`dictionaryItems` are dropped (not in schema).

- [ ] **Step 3: Add the types/properties to `dcr.json`**

Add to the `Event` `properties` array (and the same set to `SubProcess`):
```json
{ "name": "dataType", "isAttr": true, "type": "String" },
{ "name": "dataFormat", "isAttr": true, "type": "String" },
{ "name": "computation", "isAttr": true, "type": "String" },
{ "name": "eventDescription", "isAttr": true, "type": "String" },
{ "name": "groups", "isAttr": true, "type": "String" },
{ "name": "phases", "isAttr": true, "type": "String" },
{ "name": "originalType", "isAttr": true, "type": "String" },
{ "name": "dictionaryItems", "type": "DictionaryItem", "isMany": true },
{ "name": "extensions", "type": "Extensions" }
```
Add to the `Relation` `properties` array:
```json
{ "name": "expressionId", "isAttr": true, "type": "String" },
{ "name": "valueExpressionId", "isAttr": true, "type": "String" },
{ "name": "time", "isAttr": true, "type": "String" },
{ "name": "extensions", "type": "Extensions" }
```
Add to the `DcrGraph` `properties` array:
```json
{ "name": "expressions", "type": "Expression", "isMany": true },
{ "name": "roles", "isAttr": true, "type": "String" },
{ "name": "groups", "isAttr": true, "type": "String" },
{ "name": "phases", "isAttr": true, "type": "String" },
{ "name": "graphExtensions", "type": "Extensions" }
```
Add three new entries to the top-level `types` array:
```json
{
  "name": "DictionaryItem",
  "properties": [
    { "name": "label", "isAttr": true, "type": "String" },
    { "name": "value", "isAttr": true, "type": "String" }
  ]
},
{
  "name": "Expression",
  "properties": [
    { "name": "id", "isAttr": true, "type": "String", "isId": true },
    { "name": "value", "isAttr": true, "type": "String" },
    { "name": "exprType", "isAttr": true, "type": "String", "xml": { "tagAlias": "type" } },
    { "name": "definitions", "type": "Extensions" }
  ]
},
{
  "name": "Extensions",
  "properties": [
    { "name": "content", "type": "String", "isBody": true }
  ]
}
```
> Note: if moddle rejects `xml.tagAlias` on a property for the `type` attribute name, fall back to property name `type` directly (it does not collide with the relation `type` because it is on a different element). The test in Step 1 is the gate.

- [ ] **Step 4: Run to verify it passes**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: PASS — `dataType` and `label="Yes"` present in serialized output.

- [ ] **Step 5: Commit**

```bash
git add modeler/lib/moddle/resources/dcr.json modeler/test/spec/dcr-fidelity.spec.js
git commit -m "feat(modeler): declare typed data + carry properties in dcr moddle schema"
```

---

### Task 3: Import + export event data types and dictionaries

**Files:**
- Modify: `modeler/lib/DCRPortalConverter` (function `handleEvent`, normal-event branch ~lines 120-142)
- Modify: `modeler/lib/DCRXML.js` (function `addEvent` / `handleStates` area)
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Consumes: schema props from Task 2 (`dataType`, `dataFormat`, `dictionaryItems`).
- Produces: a helper `readEventData(event)` in `DCRPortalConverter` returning `{ dataType, format, dictionary: [{label,value}] }` from `event.custom[0].eventData[0]`.

- [ ] **Step 1: Write the failing round-trip test (DMN graph: Age/Country)**

```js
it('round-trips event dataType and dictionary (dmn graph)', async () => {
  const modeler = createModeler();
  await importDcrSolutions(modeler, dmnXML);
  const out = await exportDcrSolutions(modeler);
  const parsed = await parseDcr(out);
  const events = parsed.dcrgraph.specification[0].resources[0].events[0].event;
  const country = events.find(e => e.$.id === 'Country');
  const dt = country.custom[0].eventData[0].dataType[0];
  expect(dt._ || dt).toBe('choice');
  const items = country.custom[0].eventData[0].dictionary[0].item.map(i => i.$);
  expect(items).toEqual(expect.arrayContaining([
    { label: 'Denmark', value: 'Denmark' }, { label: 'USA', value: 'USA' },
  ]));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: FAIL — export has empty `eventData` (current `DCRXML.js` stub).

- [ ] **Step 3: Import — capture data in `DCRPortalConverter`**

In `handleEvent`, normal-event branch, add to the pushed `$` object:
```js
const ed = event.custom?.[0]?.eventData?.[0];
const dt = ed?.dataType?.[0];
// dt may be a string or { _: 'choice', $: { format: 'int', ... } }
const dataTypeText = typeof dt === 'object' ? dt._ : dt;
const dataFormat = (typeof dt === 'object' ? dt.$?.format : '') || '';
```
Add to the event `$`: `dataType: dataTypeText || '', dataFormat,`
and add dictionary children to the pushed `dcr:event` object:
```js
"dcr:dictionaryItems": (ed?.dictionary?.[0]?.item || []).map(i => ({ $: { label: i.$.label, value: i.$.value } })),
```

- [ ] **Step 4: Export — emit data in `DCRXML.js`**

In `addEvent`, after `handleLabels`, build the `eventData`:
```js
function handleEventData(object, element) {
  if (!element.dataType && !(element.dictionaryItems || []).length) return;
  if (!object.custom) object.custom = {};
  const eventData = {};
  if (element.dataType) {
    eventData.dataType = element.dataFormat
      ? { _: element.dataType, $: { format: element.dataFormat } }
      : element.dataType;
  }
  if ((element.dictionaryItems || []).length) {
    eventData.dictionary = { item: element.dictionaryItems.map(d => ({ $: { label: d.label, value: d.value } })) };
  }
  assign(object.custom, { eventData });
}
```
Call `handleEventData(object, element);` inside `addEvent`.

- [ ] **Step 5: Run to verify it passes**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add modeler/lib/DCRPortalConverter modeler/lib/DCRXML.js modeler/test/spec/dcr-fidelity.spec.js
git commit -m "feat(modeler): round-trip event dataType and choice dictionaries"
```

---

### Task 4: Import + export `eventDescription` (separate from label)

**Files:**
- Modify: `modeler/lib/DCRPortalConverter` (`handleEvent` all branches)
- Modify: `modeler/lib/DCRXML.js` (`addEvent`)
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Consumes: `eventDescription` schema attr (Task 2).
- Produces: convention — `description` (moddle) holds the **label** (from `labelMappings`, unchanged), `eventDescription` holds the `event/custom/eventDescription` HTML body.

- [ ] **Step 1: Write the failing test (Corona outcome label event Activity26_1)**

```js
it('round-trips eventDescription HTML separately from label', async () => {
  const modeler = createModeler();
  await importDcrSolutions(modeler, coronaXML);
  const out = await exportDcrSolutions(modeler);
  const parsed = await parseDcr(out);
  const events = [];
  const walk = e => { events.push(e); (e.event || []).forEach(walk); };
  parsed.dcrgraph.specification[0].resources[0].events[0].event.forEach(walk);
  const lowRisk = events.find(e => e.$.id === 'Activity26_1');
  expect(lowRisk.custom[0].eventDescription[0]).toContain('No need for self-isolation');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: FAIL — `eventDescription` not emitted.

- [ ] **Step 3: Import — capture eventDescription**

In every `handleEvent` branch, add to the pushed `$`:
```js
eventDescription: event.custom?.[0]?.eventDescription?.[0] || '',
```
(When the value is an empty tag xml2js yields `''` or `{}`; coerce non-string to `''`.)

- [ ] **Step 4: Export — emit eventDescription**

In `DCRXML.js` `addEvent`, inside `handleEventData` sibling, add:
```js
function handleEventDescription(object, element) {
  if (!element.eventDescription) return;
  if (!object.custom) object.custom = {};
  assign(object.custom, { eventDescription: element.eventDescription });
}
```
Call it in `addEvent`.

- [ ] **Step 5: Run to verify it passes**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: PASS.

- [ ] **Step 6: Regression — label editing still uses description**

Run: `yarn workspace modeler test -- modeler --run`
Expected: existing `modeler.spec.js` still passes (no change to label = description behavior).

- [ ] **Step 7: Commit**

```bash
git add modeler/lib/DCRPortalConverter modeler/lib/DCRXML.js modeler/test/spec/dcr-fidelity.spec.js
git commit -m "feat(modeler): preserve eventDescription HTML separately from label"
```

---

### Task 5: Preserve original event `type` (form / subprocess / nesting)

**Files:**
- Modify: `modeler/lib/DCRPortalConverter` (`handleEvent` — record `originalType`)
- Modify: `modeler/lib/DCRXML.js` (`addSubProcess` / `addNesting` — restore `form`)
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Consumes: `originalType` schema attr (Task 2).
- Produces: export emits `type="form"` for elements whose `originalType === 'form'`.

- [ ] **Step 1: Write the failing test (SU A26 is a form)**

```js
it('restores form-type containers on export (su A26)', async () => {
  const modeler = createModeler();
  await importDcrSolutions(modeler, suXML);
  const out = await exportDcrSolutions(modeler);
  const parsed = await parseDcr(out);
  const events = parsed.dcrgraph.specification[0].resources[0].events[0].event;
  const a26 = events.find(e => e.$.id === 'A26');
  expect(a26.$.type).toBe('form');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: FAIL — exported A26 has `type="subprocess"` (or none).

- [ ] **Step 3: Import — record originalType**

In the `subprocess`/`form` branch of `handleEvent`, add to the pushed subprocess `$`:
```js
originalType: event.$.type, // 'subprocess' | 'form'
```
In the `nesting` branch add `originalType: 'nesting'`; in the normal branch add `originalType: ''`.

- [ ] **Step 4: Export — restore form**

In `DCRXML.js` `addSubProcess`, set the emitted type from originalType:
```js
assign(object.$, { type: element.originalType === 'form' ? 'form' : 'subprocess' });
```

- [ ] **Step 5: Run to verify it passes**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add modeler/lib/DCRPortalConverter modeler/lib/DCRXML.js modeler/test/spec/dcr-fidelity.spec.js
git commit -m "feat(modeler): preserve original form/subprocess/nesting event type"
```

---

### Task 6: Groups/tags, phases, and graph-level role/group/phase lists

**Files:**
- Modify: `modeler/lib/DCRPortalConverter` (`handleEvent`; `convertCustomToBPMN` graph root)
- Modify: `modeler/lib/DCRXML.js` (`addEvent`; `asXML` graph root)
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Consumes: `groups`/`phases` event attrs and `roles`/`groups`/`phases` graph attrs (Task 2).
- Produces: comma-joined string encoding for multi-valued lists (e.g. `groups="ShowInChatSOP"`, `phases="Start,Conclusion"`); export splits on `,`.

- [ ] **Step 1: Write the failing test (Corona ShowInChatSOP + phases)**

```js
it('round-trips event groups (ShowInChatSOP) and phases', async () => {
  const modeler = createModeler();
  await importDcrSolutions(modeler, coronaXML);
  const out = await exportDcrSolutions(modeler);
  const parsed = await parseDcr(out);
  const events = [];
  const walk = e => { events.push(e); (e.event || []).forEach(walk); };
  parsed.dcrgraph.specification[0].resources[0].events[0].event.forEach(walk);
  const first = events.find(e => e.$.id === 'FirstPCRTest');
  const groups = (first.custom[0].groups[0].group || []).map(g => (typeof g === 'object' ? g._ : g));
  expect(groups).toContain('ShowInChatSOP');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: FAIL.

- [ ] **Step 3: Import — capture groups/phases**

In `handleEvent`, add to event `$`:
```js
groups: (event.custom?.[0]?.groups?.[0]?.group || []).map(g => typeof g === 'object' ? g._ : g).filter(Boolean).join(','),
phases: (event.custom?.[0]?.phases?.[0]?.phase || []).map(p => typeof p === 'object' ? p._ : p).filter(Boolean).join(','),
```
In `convertCustomToBPMN`, after building `bpmn`, set graph-root attrs on `bpmn["dcr:definitions"]["dcr:dcrGraph"].$`:
```js
const gcustom = result.dcrgraph.specification[0].resources[0].custom?.[0];
const join = (arr) => (arr || []).map(x => typeof x === 'object' ? x._ : x).filter(Boolean).join(',');
bpmn["dcr:definitions"]["dcr:dcrGraph"].$.roles = join(gcustom?.roles?.[0]?.role);
bpmn["dcr:definitions"]["dcr:dcrGraph"].$.groups = join(gcustom?.groups?.[0]?.group);
bpmn["dcr:definitions"]["dcr:dcrGraph"].$.phases = join(gcustom?.phases?.[0]?.phase);
```

- [ ] **Step 4: Export — emit groups/phases**

In `DCRXML.js` `addEvent` add a `handleGroupsPhases(object, element)` that, when `element.groups`/`element.phases` are non-empty, writes `object.custom.groups = { group: element.groups.split(',').map(g => ({ _: g })) }` and the analogous `phases`. In `asXML`, read `definitions.rootElements[0].roles/groups/phases` and write them under `dcr.dcrgraph.specification.resources.custom`.

- [ ] **Step 5: Run to verify it passes**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add modeler/lib/DCRPortalConverter modeler/lib/DCRXML.js modeler/test/spec/dcr-fidelity.spec.js
git commit -m "feat(modeler): round-trip event groups/phases and graph role/group/phase lists"
```

---

### Task 7: Expressions list + `computation` + relation `expressionId`/`time`/`valueExpressionId`

**Files:**
- Modify: `modeler/lib/DCRPortalConverter` (`handleEvent` computation; `handleRelations`; `convertCustomToBPMN` expressions)
- Modify: `modeler/lib/DCRXML.js` (`addLink`; `asXML` expressions; `addEvent` computation)
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Consumes: `expressions` list + `Expression` type, `computation`, relation `expressionId`/`time`/`valueExpressionId` (Task 2).
- Produces: expression `value` round-trips; DMN `<definitions>` block is **not** yet preserved (carry, Task 10) — assert only `value`/`id`/`type` here.

- [ ] **Step 1: Write the failing test (DMN computation value + relation expressionId)**

```js
it('round-trips expressions, computation refs, and relation guards', async () => {
  const modeler = createModeler();
  await importDcrSolutions(modeler, dmnXML);
  const out = await exportDcrSolutions(modeler);
  const parsed = await parseDcr(out);
  const exprs = parsed.dcrgraph.specification[0].resources[0].expressions[0].expression;
  const comp = exprs.find(e => e.$.id === 'DMN-computation');
  expect(comp.$.value).toContain('If(');
  const updateExpr = exprs.find(e => e.$.id === 'DMN-path-A4--update--value');
  expect(updateExpr.$.value).toContain('Can you purchase alcohol?');
  const events = parsed.dcrgraph.specification[0].resources[0].events[0].event;
  expect(events.find(e => e.$.id === 'DMN').$.computation).toBe('DMN-computation');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: FAIL — empty `expressions`, no `computation` attr.

- [ ] **Step 3: Import — expressions, computation, guards**

In `convertCustomToBPMN`, map the expressions list onto the graph as moddle children:
```js
const exprList = result.dcrgraph.specification[0].resources[0].expressions?.[0]?.expression || [];
bpmn["dcr:definitions"]["dcr:dcrGraph"]["dcr:expressions"] = exprList.map(e => ({
  $: { id: e.$.id, value: e.$.value, type: e.$.type || '' },
}));
```
In `handleEvent`, add `computation: event.$.computation || ''` to the event `$`.
In `handleRelations`, when pushing each `dcr:relation`, add `expressionId`, `time`, `valueExpressionId` from `relation.$`.

- [ ] **Step 4: Export — expressions, computation, guards**

In `asXML`, build `dcr.dcrgraph.specification.resources.expressions = { expression: (rootElements[0].expressions||[]).map(e => ({ $: { id: e.id, value: e.value, type: e.exprType || e.type } })) }`. In `addLink`, copy `expressionId`/`time`/`valueExpressionId` from `element` into the link `$`. In `addEvent`, copy `element.computation` into the event `$` when present.

- [ ] **Step 5: Run to verify it passes**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add modeler/lib/DCRPortalConverter modeler/lib/DCRXML.js modeler/test/spec/dcr-fidelity.spec.js
git commit -m "feat(modeler): round-trip expressions, computation refs, relation guards"
```

---

### Task 8: All constraint sections — `coresponse`, `update`, `spawn`, timing

**Files:**
- Modify: `modeler/lib/DCRPortalConverter` (`getRelationType`, `handleRelations`)
- Modify: `modeler/lib/DCRXML.js` (`addLink` — write to the correct section, incl. `coresponse`/`update`/`spawn`)
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Consumes: relation `type` values incl. `coresponse`/`update`/`spawn`; `valueExpressionId`/`time` (Task 7).
- Produces: export writes each relation into the matching `<constraints>` child (`responses`/`coresponses`/`updates`/`spawns`/...). `addLink` no longer assumes `${type}s` blindly; uses an explicit section map.

- [ ] **Step 1: Write the failing test (DMN update; Corona coresponse)**

```js
it('round-trips coresponse and update relations', async () => {
  const m1 = createModeler();
  await importDcrSolutions(m1, dmnXML);
  const dmnOut = await parseDcr(await exportDcrSolutions(m1));
  const updates = dmnOut.dcrgraph.specification[0].constraints[0].updates[0].update;
  expect(updates[0].$.valueExpressionId).toBe('DMN-path-A4--update--value');

  const m2 = createModeler();
  await importDcrSolutions(m2, coronaXML);
  const corOut = await parseDcr(await exportDcrSolutions(m2));
  const cores = corOut.dcrgraph.specification[0].constraints[0].coresponses[0].coresponse;
  expect(cores.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: FAIL.

- [ ] **Step 3: Import — map every constraint section**

Confirm `handleRelations` iterates all sections (it iterates `Object.values(xml.specification[0].constraints[0])`); ensure `getRelationType` returns the singular type for `coresponses`→`coresponse`, `updates`→`update`, `spawns`→`spawn`, `templateSpawns`→`spawn`. Add the relation `$` attrs `valueExpressionId`, `time` (already added Task 7). Ensure the relation `type` is stored on the `dcr:relation`.

- [ ] **Step 4: Export — section map in `addLink`**

Replace the `constraints[`${element.type}s`]` access with an explicit map:
```js
const SECTION = {
  condition: ['conditions','condition'], response: ['responses','response'],
  coresponse: ['coresponses','coresponse'], include: ['includes','include'],
  exclude: ['excludes','exclude'], milestone: ['milestones','milestone'],
  update: ['updates','update'], spawn: ['spawns','spawn'],
};
const [sec, tag] = SECTION[element.type] || [`${element.type}s`, element.type];
if (!dcr.dcrgraph.specification.constraints[sec]) dcr.dcrgraph.specification.constraints[sec] = { [tag]: [] };
dcr.dcrgraph.specification.constraints[sec][tag].push(object);
```
Carry `expressionId`/`valueExpressionId`/`time` into `object.$`.

- [ ] **Step 5: Run to verify it passes**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add modeler/lib/DCRPortalConverter modeler/lib/DCRXML.js modeler/test/spec/dcr-fidelity.spec.js
git commit -m "feat(modeler): round-trip coresponse, update, spawn and timed relations"
```

---

### Task 9: Per-element opaque carry (`extensions`)

**Files:**
- Modify: `modeler/lib/DCRPortalConverter` (`handleEvent` — serialize un-modeled `custom/*`)
- Modify: `modeler/lib/DCRXML.js` (`addEvent`/`addSubProcess`/`addNesting` — splice carry back)
- Create: `modeler/lib/carry.js` (shared `serializeCarry`/`spliceCarry` using xml2js Builder/parse)
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Consumes: `extensions` body element (Task 2).
- Produces: `carry.js` exporting `serializeCustomExtras(customObj, modeledKeys): string` (returns an XML string of the `custom` children not in `modeledKeys`) and `mergeCarry(targetCustomObj, carryString): void` (parses and assigns carried children back).

- [ ] **Step 1: Write the failing test (per-event colors preserved)**

```js
it('preserves un-modeled per-event custom (visualization colors)', async () => {
  const modeler = createModeler();
  await importDcrSolutions(modeler, dmnXML);
  const out = await exportDcrSolutions(modeler);
  const parsed = await parseDcr(out);
  const country = parsed.dcrgraph.specification[0].resources[0].events[0].event
    .find(e => e.$.id === 'Country');
  expect(country.custom[0].visualization[0].colors[0].$.bg).toBe('#f9f7ed');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: FAIL — colors dropped.

- [ ] **Step 3: Write `carry.js`**

```js
// modeler/lib/carry.js
import { Builder, parseStringPromise } from 'xml2js';

// Serialize an arbitrary xml2js object under a given root tag.
export function serializeFragment(rootName, obj) {
  if (!obj || Object.keys(obj).length === 0) return '';
  const builder = new Builder({ headless: true, rootName });
  return builder.buildObject(obj);
}

export function serializeCustomExtras(customObj, modeledKeys) {
  if (!customObj) return '';
  const extras = {};
  for (const k of Object.keys(customObj)) {
    if (!modeledKeys.includes(k)) extras[k] = customObj[k];
  }
  return serializeFragment('extensions', extras);
}

export async function parseCarry(carryString) {
  if (!carryString) return {};
  const parsed = await parseStringPromise(carryString);
  return parsed.extensions || {};
}

// Parse a fragment serialized with serializeFragment(rootName, ...).
export async function parseFragment(rootName, fragmentString) {
  if (!fragmentString) return {};
  const parsed = await parseStringPromise(fragmentString);
  return parsed[rootName] || {};
}
```

- [ ] **Step 4: Import — attach carry string**

In `handleEvent`, compute the carry from `event.custom[0]` excluding modeled keys and attach as a child:
```js
const MODELED = ['eventData','eventDescription','groups','phases','roles']; // roles handled via $.role
const carry = serializeCustomExtras(event.custom?.[0], MODELED);
// add to pushed dcr element:
"dcr:extensions": carry ? [{ _: carry }] : undefined,
```
> The intermediate dcr: XML stores the carry as escaped element text; moddle reads it back into `businessObject.extensions.content`.

- [ ] **Step 5: Export — splice carry back**

In `DCRXML.js` element builders, after writing modeled `custom`, merge carry:
```js
const carried = element.extensions && element.extensions.content;
if (carried) {
  const extras = await parseCarry(carried);
  if (!object.custom) object.custom = {};
  Object.assign(object.custom, extras);
}
```
(Make `addElement`/`asXML` async-aware, or pre-parse carry synchronously by storing parsed object; simplest: make the builder functions `async` and `await` them in `asXML`.)

- [ ] **Step 6: Run to verify it passes**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add modeler/lib/carry.js modeler/lib/DCRPortalConverter modeler/lib/DCRXML.js modeler/test/spec/dcr-fidelity.spec.js
git commit -m "feat(modeler): preserve per-element un-modeled custom via opaque carry"
```

---

### Task 10: Root opaque carry (`graphExtensions`) + expression DMN definitions + full lossless

**Files:**
- Modify: `modeler/lib/DCRPortalConverter` (`convertCustomToBPMN` — root carry + expression definitions)
- Modify: `modeler/lib/DCRXML.js` (`asXML` — splice root carry + DMN)
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Consumes: `graphExtensions` (Task 2), `carry.js` (Task 9), `Expression.definitions` (Task 2).
- Produces: full unedited round-trip is content-identical for all three graphs.

- [ ] **Step 1: Write the failing tests (graphDetails, DMN definitions, full diff)**

```js
it('preserves graphDetails and DMN definitions and is fully lossless', async () => {
  for (const xml of [coronaXML, suXML, dmnXML]) {
    const modeler = createModeler();
    await importDcrSolutions(modeler, xml);
    const out = await exportDcrSolutions(modeler);
    const before = await parseDcr(xml);
    const after = await parseDcr(out);
    // graphDetails preserved
    const gdBefore = before.dcrgraph.specification[0].resources[0].custom[0].graphDetails;
    const gdAfter = after.dcrgraph.specification[0].resources[0].custom[0].graphDetails;
    expect(!!gdAfter).toBe(!!gdBefore);
    // every event id preserved
    expect(collectEventIds(after)).toEqual(collectEventIds(before));
  }
});

it('preserves embedded DMN definitions on expressions', async () => {
  const modeler = createModeler();
  await importDcrSolutions(modeler, dmnXML);
  const after = await parseDcr(await exportDcrSolutions(modeler));
  const comp = after.dcrgraph.specification[0].resources[0].expressions[0].expression
    .find(e => e.$.id === 'DMN-computation');
  expect(comp.definitions).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: FAIL.

- [ ] **Step 3: Import — root carry + expression definitions**

In `convertCustomToBPMN`, serialize all un-modeled top-level content into a root carry string and attach to the graph:
```js
const rootExtras = {
  meta: result.dcrgraph.meta, runtime: result.dcrgraph.runtime,
  // top-level <dcrgraph> attributes:
  _attrs: result.dcrgraph.$,
  // un-modeled resources children:
  resourcesExtras: serializeCustomExtras(result.dcrgraph.specification[0].resources[0],
    ['events','subProcesses','labels','labelMappings','expressions','custom']),
  customExtras: serializeCustomExtras(result.dcrgraph.specification[0].resources[0].custom?.[0],
    ['roles','groups','phases']), // keep graphDetails etc.
};
bpmn["dcr:definitions"]["dcr:dcrGraph"]["dcr:graphExtensions"] = [{ _: builderHeadless(rootExtras) }];
```
For each expression, attach its `<definitions>` subtree as the expression's carry:
```js
expression definitions: e.definitions ? builderHeadless({ definitions: e.definitions }) : ''
```
(stored as `dcr:expressions` child `dcr:definitions` body text).

- [ ] **Step 4: Export — splice root carry + DMN**

In `asXML`, parse `definitions.rootElements[0].graphExtensions.content`, restore `meta`/`runtime`/top-level `$` attributes and the carried resources/custom children onto the output object; for each expression, if `expr.definitions.content` present, parse and attach under the expression. Set `dcr.dcrgraph.$ = carriedAttrs`.

- [ ] **Step 5: Run to verify it passes**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: PASS — all three graphs lossless; DMN definitions present.

- [ ] **Step 6: Secondary round-trip — internal saveXML preserves carry**

Add a test: import DCR Solutions → `saveXML` → `importXML` → `saveDCRXML`, then assert `collectEventIds` and `graphDetails` still match. Run and confirm PASS.

- [ ] **Step 7: Commit**

```bash
git add modeler/lib/DCRPortalConverter modeler/lib/DCRXML.js modeler/test/spec/dcr-fidelity.spec.js
git commit -m "feat(modeler): root opaque carry, DMN definitions, full lossless round-trip"
```

---

### Task 11: Consolidate on a single importer

**Files:**
- Modify: `modeler/lib/BaseViewer.js:170-172` (`importCustomXML` delegates to `DCRPortalConverter`)
- Modify: `app/src/components/Examples.tsx:64-71` (drop the `<?xml` dispatch; always call one open path)
- Delete: `modeler/lib/XMLConverter.js`
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Consumes: `DCRPortalConverter` (now lossless).
- Produces: `importCustomXML === importDCRPortalXML` behavior; one code path.

- [ ] **Step 1: Write the failing test (every bundled example imports via the portal path)**

```js
import prescribe from '/../app/public/examples/diagrams/Subprocess.xml?raw';
it('imports a bundled example via DCRPortalConverter without error', async () => {
  const modeler = createModeler();
  await expect(importDcrSolutions(modeler, prescribe)).resolves.toBeDefined();
});
```
> If the `?raw` cross-package import path is awkward under vitest, copy `Subprocess.xml` into `modeler/test/fixtures/dcrsolutions/example-subprocess.xml` and import that.

- [ ] **Step 2: Run to verify it fails or errors**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: FAIL/throw if `DCRPortalConverter` can't yet parse the `<?xml`-prolog example dialect.

- [ ] **Step 3: Make `DCRPortalConverter` handle the example dialect**

Reconcile any dialect gaps surfaced by Step 2 (e.g. `getDescription` for events without nested templates). Keep changes minimal and covered by the Step 1 test.

- [ ] **Step 4: Delegate `importCustomXML` and delete `XMLConverter.js`**

In `BaseViewer.js`:
```js
BaseViewer.prototype.importCustomXML = async function (xml, rootBoard) {
  return this.importXML(await DCRPortalConverter(xml), rootBoard);
};
```
Remove `import XMLConverter from './XMLConverter';` and delete the file.

- [ ] **Step 5: Simplify the app dispatch**

In `Examples.tsx`, replace the `<?xml` branch so both cases call the same open path (route through `openDCRXML`/`importDCRPortalXML`). Keep `openCustomXML` prop temporarily aliased to the same handler to avoid a wider refactor.

- [ ] **Step 6: Run modeler + app build**

Run: `yarn workspace modeler test -- --run` then `yarn workspace app predeploy`
Expected: modeler tests PASS; app type-checks/builds (the known large-chunk warning is fine).

- [ ] **Step 7: Commit**

```bash
git add modeler/lib/BaseViewer.js app/src/components/Examples.tsx modeler/test/spec/dcr-fidelity.spec.js
git rm modeler/lib/XMLConverter.js
git commit -m "refactor(modeler): consolidate on DCRPortalConverter as the single importer"
```

---

### Task 12: Acceptance — full corpus round-trip gate

**Files:**
- Modify: `modeler/test/spec/dcr-fidelity.spec.js` (add the consolidated acceptance test)
- Test: `modeler/test/spec/dcr-fidelity.spec.js`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the acceptance test (per-construct presence across all three graphs)**

```js
it('acceptance: all §12 constructs survive for corona/su/dmn', async () => {
  for (const xml of [coronaXML, suXML, dmnXML]) {
    const modeler = createModeler();
    await importDcrSolutions(modeler, xml);
    const before = await parseDcr(xml);
    const after = await parseDcr(await exportDcrSolutions(modeler));
    expect(collectEventIds(after)).toEqual(collectEventIds(before));
    // expression count preserved
    const ce = (p) => (p.dcrgraph.specification[0].resources[0].expressions?.[0]?.expression || []).length;
    expect(ce(after)).toBe(ce(before));
    // relation count per section preserved
    const rc = (p) => collectRelations(p).length;
    expect(rc(after)).toBe(rc(before));
  }
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `yarn workspace modeler test -- dcr-fidelity --run`
Expected: PASS for all three graphs.

- [ ] **Step 3: Full suite + app build**

Run: `yarn workspace modeler test -- --run` then `yarn workspace app predeploy`
Expected: all PASS / build OK.

- [ ] **Step 4: Commit**

```bash
git add modeler/test/spec/dcr-fidelity.spec.js
git commit -m "test(modeler): full DCR Solutions round-trip acceptance gate"
```

---

## Self-Review Notes (coverage map spec → tasks)

- Schema typed Bucket-1 → Task 2. Carry holders → Task 2 (+ behavior Tasks 9–10).
- Event data/dictionary → Task 3. `eventDescription` split → Task 4. Original `type` → Task 5. Groups/phases/roles → Task 6. Expressions/computation/guards → Task 7. coresponse/update/spawn/timing → Task 8.
- Per-element carry → Task 9. Root carry + DMN definitions + lossless + secondary saveXML round-trip → Task 10.
- Importer consolidation + retire `XMLConverter.js` + app call site → Task 11.
- Acceptance corpus gate → Task 12.
- Out-of-scope (rendering, editing, engine eval, DMN editing) — not in any task, by design.

**Open implementation detail intentionally left to the implementer:** whether the export builder functions become `async` (to `await parseCarry`) or pre-parse carry to objects at import time. Task 9 Step 5 notes both; pick one and apply consistently.
