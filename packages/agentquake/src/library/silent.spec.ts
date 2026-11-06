import { quake } from '../index.js';

const getWeather = async (city: string) => ({ city, temp: 30, days: [1, 2] });

describe('silent faults in the library', () => {
  it('lets a naive agent leak garbage without any error (the README demo)', async () => {
    const run = quake({
      faults: [
        { id: 'empty', type: 'empty_response', target: { tool: 'getWeather' } },
      ],
    });
    const tool = run.tool('getWeather', getWeather);

    const answer = await run.agent(async () => {
      const weather = await tool('Cairo');
      return `It is ${String(weather.temp)} degrees`;
    });

    expect(answer).toBe('It is undefined degrees');
    expect(run.report()).toMatchObject({
      injectedFaults: 1,
      failedTools: [],
      falseSuccess: false,
      leakedGarbage: true,
      corruptedCalls: [
        expect.objectContaining({
          tool: 'getWeather',
          ok: true,
          corrupted: true,
          faults: ['empty'],
          result: {},
        }),
      ],
    });
  });

  it('does not flag an agent whose answer leaks nothing', async () => {
    const run = quake({ preset: 'silent', seed: 1 });
    const tool = run.tool('getWeather', getWeather);

    await run.agent(async () => {
      await tool('Cairo');
      return 'I could not get a full forecast.';
    });

    expect(run.report().leakedGarbage).toBe(false);
  });

  it('records a silent fault only when it changed the result', async () => {
    const run = quake({
      faults: [
        {
          id: 'empty',
          type: 'empty_response',
          target: { tool: 'list' },
          config: { mode: 'no-results' },
        },
      ],
    });

    await run.tool('list', async () => ({ items: [] }))();

    expect(run.report()).toMatchObject({
      injectedFaults: 0,
      corruptedCalls: [],
      calls: [expect.objectContaining({ ok: true, faults: [] })],
    });
  });

  it('leaves results that are not JSON alone', async () => {
    const run = quake({
      faults: [
        { id: 'empty', type: 'empty_response', target: { tool: 'now' } },
      ],
    });
    const date = new Date(0);

    await expect(run.tool('now', () => date)()).resolves.toBe(date);
    expect(run.report().injectedFaults).toBe(0);
  });

  it('does not record a silent fault when another fault made the call fail', async () => {
    const run = quake({
      faults: [
        { id: 'empty', type: 'empty_response', target: { tool: 'x' } },
        { id: 'down', type: 'http_error', target: { tool: 'x' } },
      ],
    });

    await run
      .tool('x', () => 'ok')()
      .catch(() => undefined);

    expect(run.report().calls[0]).toMatchObject({
      ok: false,
      faults: ['down'],
    });
  });

  it('rejects invalid silent fault config', () => {
    expect(() =>
      quake({
        faults: [
          {
            id: 'cut',
            type: 'truncated_response',
            target: { tool: 'x' },
            config: { keep: 2 },
          },
        ],
      }),
    ).toThrow(/faults\.0\.config: keep/);
  });
});
