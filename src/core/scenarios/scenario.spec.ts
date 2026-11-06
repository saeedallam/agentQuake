import { parseScenario } from './scenario.js';

const knownTypes = ['latency', 'http_error', 'timeout'];

const validYaml = `
version: 1
name: flaky-weather
seed: 42
faults:
  - id: slow-forecast
    type: latency
    target: { tool: weather, path: "/forecast*" }
    probability: 0.5
    config: { delayMs: 2000 }
  - id: rate-limited
    type: http_error
    target: { tool: weather }
    config: { status: 429 }
`;

describe('parseScenario', () => {
  it('reads a valid scenario and fills in defaults', () => {
    const result = parseScenario(validYaml, knownTypes);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.name).toBe('flaky-weather');
      expect(result.scenario.faults).toHaveLength(2);
      expect(result.scenario.faults[1].probability).toBe(1);
    }
  });

  it('reports a YAML syntax error with its line', () => {
    const result = parseScenario('version: 1\nname: [broken', knownTypes);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].message).toMatch(/YAML syntax error/);
    }
  });

  it('rejects a probability above 1', () => {
    const yaml = validYaml.replace('probability: 0.5', 'probability: 5');

    const result = parseScenario(yaml, knownTypes);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].path).toBe('faults.0.probability');
    }
  });

  it('rejects an unknown fault type', () => {
    const yaml = validYaml.replace('type: latency', 'type: slow_dns');

    const result = parseScenario(yaml, knownTypes);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        expect.objectContaining({ path: 'faults.0.type' }),
      ]);
    }
  });

  it('rejects two faults with the same id', () => {
    const yaml = validYaml.replace('id: rate-limited', 'id: slow-forecast');

    const result = parseScenario(yaml, knownTypes);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].message).toMatch(/Duplicate fault id/);
    }
  });

  it('rejects a missing version', () => {
    const result = parseScenario('name: no-version', knownTypes);

    expect(result.ok).toBe(false);
  });
});
