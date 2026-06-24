import { it, expect, describe } from 'vitest';
import coronaXML from '../fixtures/dcrsolutions/corona.xml?raw';
import suXML from '../fixtures/dcrsolutions/su.xml?raw';
import dmnXML from '../fixtures/dcrsolutions/dmn.xml?raw';
import {
  createModeler, importDcrSolutions, exportDcrSolutions, parseDcr, collectEventIds, collectRelations,
} from '../helper/roundTrip';

describe('DCR Solutions round-trip', () => {
  it('completes a headless round-trip and keeps event ids (dmn)', async () => {
    const m = createModeler();
    await importDcrSolutions(m, dmnXML);
    const out = await exportDcrSolutions(m);
    expect(out).toContain('<dcrgraph');
    for (const id of ['Age', 'Country', 'DMN', 'A4']) {
      expect(out).toContain(`id="${id}"`);
    }
  });
});
