import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError, quakeOptionsFrom } from './options.js';

const dir = mkdtempSync(join(tmpdir(), 'agentquake-options-'));

describe('quakeOptionsFrom', () => {
  it('reads a preset and a seed', () => {
    expect(quakeOptionsFrom({ preset: 'flaky', seed: '42' })).toEqual({
      preset: 'flaky',
      seed: 42,
    });
  });

  it('reads faults and a seed from a scenario file, and --seed wins', () => {
    const file = join(dir, 'scenario.yaml');
    writeFileSync(
      file,
      `version: 1
name: flaky-weather
seed: 7
faults:
  - id: slow
    type: latency
    target: { tool: get_forecast }
`,
    );

    expect(quakeOptionsFrom({ scenario: file })).toEqual({
      faults: [
        { id: 'slow', type: 'latency', target: { tool: 'get_forecast' } },
      ],
      seed: 7,
    });
    expect(quakeOptionsFrom({ scenario: file, seed: '3' }).seed).toBe(3);
  });

  it('explains what is wrong with the flags or the file', () => {
    const broken = join(dir, 'broken.yaml');
    writeFileSync(broken, 'faults: [');

    expect(() => quakeOptionsFrom({ seed: 'abc' })).toThrow(CliError);
    expect(() =>
      quakeOptionsFrom({ scenario: join(dir, 'missing.yaml') }),
    ).toThrow(/Cannot read the scenario file/);
    expect(() => quakeOptionsFrom({ scenario: broken })).toThrow(
      /not valid YAML/,
    );
  });
});
