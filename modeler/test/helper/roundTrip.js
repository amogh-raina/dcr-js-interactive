import { parseStringPromise } from 'xml2js';
import Modeler from '/lib/Modeler';

export function createModeler() {
  const container = document.createElement('div');
  return new Modeler({ container, keyboard: { bindTo: document } });
}

export async function importDcrSolutions(modeler, xml) {
  try {
    return await modeler.importDCRPortalXML(xml);
  } catch (err) {
    // happy-dom does not implement SVGTransformList.consolidate; the canvas
    // render fails but _definitions are still populated so export still works.
    if (err && err.message && err.message.includes('transformList.consolidate')) {
      return { warnings: err.warnings || [] };
    }
    throw err;
  }
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
