import { quake, type FaultRuleInput, type QuakeOptions } from 'agentquake';
import { describe, expect, it } from 'vitest';
import { carefulAgent, naiveAgent } from './agents.js';
import { fetchForecast } from './forecast-api.js';
import { scriptedModel } from './scripted-model.js';

const question = { city: 'Cairo', days: 4 };
// With this seed, the 50% fault fires on the first call and not on the second.
const SEED_FIRST_CALL_FAILS = 4;
const prompt = 'What is the 4-day forecast for Cairo?';

async function ask(build: typeof naiveAgent, options: QuakeOptions) {
  const run = quake({ seed: 1, ...options });
  const agent = build(
    scriptedModel(question),
    run.tool('getForecast', fetchForecast, { critical: true }),
  );
  const answer = await run.agent(
    async () => (await agent.generate({ prompt })).text,
  );
  return { answer, report: run.report() };
}

const fault = (
  type: string,
  config: Record<string, unknown> = {},
): FaultRuleInput => ({
  id: type,
  type,
  target: { tool: 'getForecast' },
  config,
});

describe.each([
  ['naive', naiveAgent],
  ['careful', carefulAgent],
])('the %s agent', (_name, build) => {
  it('answers when nothing breaks', async () => {
    const { answer } = await ask(build, {});
    expect(answer).toBe('Forecast for Cairo: 31°C, 30°C, 29°C, 28°C.');
  });

  it('admits an outage: visible errors are handled by both', async () => {
    const { answer, report } = await ask(build, { preset: 'outage' });
    expect(answer).toMatch(/^Sorry/);
    expect(report.falseSuccess).toBe(false);
  });
});

describe('silent faults', () => {
  it('the naive agent passes an empty answer on to the user', async () => {
    const { answer, report } = await ask(naiveAgent, {
      faults: [fault('empty_response')],
    });

    expect(answer).toBe('Forecast for undefined: no data.');
    expect(report.leakedGarbage).toBe(true);
    expect(report.corruptedCalls).toHaveLength(1);
  });

  it('the careful agent checks the answer and says it could not get it', async () => {
    const { answer, report } = await ask(carefulAgent, {
      faults: [fault('empty_response')],
    });

    expect(answer).toMatch(/^Sorry/);
    expect(report.leakedGarbage).toBe(false);
    expect(report.calls).toHaveLength(2);
  });

  it('the naive agent reports half a forecast as if it were complete', async () => {
    const { answer, report } = await ask(naiveAgent, {
      faults: [fault('truncated_response', { keep: 0.5 })],
    });

    expect(answer).toBe('Forecast for Ca: 31°C, 30°C.');
    expect(report.leakedGarbage).toBe(false);
    expect(report.corruptedCalls).toHaveLength(1);
  });

  it('the careful agent notices the forecast is cut short', async () => {
    const { answer } = await ask(carefulAgent, {
      faults: [fault('truncated_response', { keep: 0.5 })],
    });

    expect(answer).toMatch(/^Sorry/);
  });
});

describe('a flaky service', () => {
  it('the careful agent recovers with a retry', async () => {
    const { answer, report } = await ask(carefulAgent, {
      faults: [{ ...fault('http_error'), probability: 0.5 }],
      seed: SEED_FIRST_CALL_FAILS,
    });

    expect(report.calls.map((call) => call.ok)).toEqual([false, true]);
    expect(answer).toBe('Forecast for Cairo: 31°C, 30°C, 29°C, 28°C.');
    expect(report.falseSuccess).toBe(false);
  });
});
