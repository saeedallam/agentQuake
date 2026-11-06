import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quake } from '../library/quake.js';
import { JsonlTraceStore, parseJsonl } from './jsonl-trace-store.js';
import { formatReport } from './report.js';

describe('JsonlTraceStore', () => {
  it('writes one line per call, with the seed, and reads them back', async () => {
    const file = join(
      mkdtempSync(join(tmpdir(), 'agentquake-traces-')),
      't.jsonl',
    );
    const run = quake({
      preset: 'outage',
      seed: 5,
      store: new JsonlTraceStore(file, 5),
    });
    const add = run.tool('add', (a: number, b: number) => a + b);

    await add(1, 2).catch(() => undefined);
    await add(3, 4).catch(() => undefined);

    const lines = readFileSync(file, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      seed: 5,
      sequence: 1,
      tool: 'add',
      ok: false,
      status: 503,
    });
    expect(parseJsonl(readFileSync(file, 'utf8'))).toHaveLength(2);
  });
});

describe('formatReport', () => {
  it('summarizes calls in a table', () => {
    const report = formatReport(
      [
        {
          sequence: 1,
          tool: 'weather',
          path: '/forecast',
          args: [],
          faults: ['down'],
          ok: false,
          status: 503,
          durationMs: 1,
        },
        {
          sequence: 2,
          tool: 'weather',
          path: '/current',
          args: [],
          faults: [],
          ok: true,
          durationMs: 1,
        },
      ],
      42,
    );

    expect(report).toContain('Calls: 2');
    expect(report).toContain('Faults injected: 1');
    expect(report).toContain('Tools whose last call failed: none');
    expect(report).toContain('Seed: 42');
    expect(report).toMatch(/1 {2}weather \/forecast\s+failed 503\s+down/);
  });
});
