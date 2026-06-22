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
