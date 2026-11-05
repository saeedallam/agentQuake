import { describe, expect, it } from 'vitest';
import type { PlannedFault } from './fault-planner.js';
import { FaultRegistry } from './fault-registry.js';
import { runFaults } from './fault-runner.js';

const latency: PlannedFault = {
  ruleId: 'slow',
  type: 'latency',
  config: { delayMs: 0 },
};
const error503: PlannedFault = {
  ruleId: 'down',
  type: 'http_error',
  config: { status: 503 },
};
const error429: PlannedFault = {
  ruleId: 'limited',
  type: 'http_error',
  config: { status: 429 },
};
const unknown: PlannedFault = {
  ruleId: 'mystery',
  type: 'unknown',
  config: {},
};

describe('runFaults', () => {
  const registry = new FaultRegistry();

  it('continues when there are no faults', async () => {
    expect(await runFaults([], registry)).toEqual({
      applied: [],
      outcome: { kind: 'continue' },
    });
  });

  it('continues after faults that only delay', async () => {
    const run = await runFaults([latency], registry);

    expect(run.applied).toEqual([latency]);
    expect(run.outcome).toEqual({ kind: 'continue' });
  });

  it('stops at the first fault that responds', async () => {
    const run = await runFaults([latency, error503, error429], registry);

    expect(run.applied).toEqual([latency, error503]);
    expect(run.outcome).toMatchObject({ kind: 'respond', status: 503 });
  });

  it('skips fault types that are not registered', async () => {
    const run = await runFaults([unknown, error503], registry);

    expect(run.applied).toEqual([error503]);
    expect(run.outcome).toMatchObject({ kind: 'respond', status: 503 });
  });
});
