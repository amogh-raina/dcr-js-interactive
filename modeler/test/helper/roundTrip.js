import { parseStringPromise } from 'xml2js';
import DCRPortalConverter from '/lib/DCRPortalConverter';
import DCRModdle from '/lib/moddle';
import asXML from '/lib/DCRXML';

// Headless: happy-dom lacks SVG, so we never instantiate a Modeler/canvas.
// Round-trip = DCR Solutions XML -> intermediate dcr: XML -> moddle tree -> DCR Solutions XML.
export function createModeler() { return { defs: null }; }

export async function importDcrSolutions(holder, dcrSolutionsXml) {
  const dcrXml = await DCRPortalConverter(dcrSolutionsXml);
  const moddle = DCRModdle();
  const { rootElement } = await moddle.fromXML(dcrXml, 'dcr:Definitions');
  holder.defs = rootElement;
  return rootElement;
}

export async function exportDcrSolutions(holder) {
  const { xml } = await asXML({}, holder.defs);
  return xml;
}

export async function internalRoundTrip(holder) {
  const moddle = DCRModdle();
  const { xml } = await moddle.toXML(holder.defs);
  const { rootElement } = await moddle.fromXML(xml, 'dcr:Definitions');
  holder.defs = rootElement;
  return rootElement;
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
      if (!row || typeof row !== 'object') continue;
      for (const relKey of Object.keys(row)) {
        for (const rel of (row[relKey] || [])) {
          if (rel && rel.$) out.push({ section, ...rel.$ });
        }
      }
    }
  }
  return out;
}
