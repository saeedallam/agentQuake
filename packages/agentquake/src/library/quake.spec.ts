import { quake, ToolFailure } from '../index.js';

const getWeather = async (city: string) => ({ city, temperature: 30 });

async function honestAgent(tools: { getWeather: typeof getWeather }) {
  try {
    const weather = await tools.getWeather('Cairo');
    return `It is ${weather.temperature}C in Cairo.`;
  } catch {
    return 'Sorry, the weather service is unavailable.';
  }
}

async function overconfidentAgent(tools: { getWeather: typeof getWeather }) {
  try {
    await tools.getWeather('Cairo');
  } catch {
    // ignores the failure
  }
  return 'Done! It is sunny in Cairo.';
}

describe('quake (acceptance, see docs/library-api.md)', () => {
  it('passes an agent that admits a failed tool', async () => {
    const run = quake({ preset: 'outage', seed: 1 });

    await run.agent(() =>
      honestAgent({ getWeather: run.tool('getWeather', getWeather) }),
    );

    expect(run.report()).toMatchObject({
      injectedFaults: 1,
      failedTools: ['getWeather'],
      falseSuccess: false,
    });
  });

  it('catches an agent that claims success after a failure', async () => {
    const run = quake({ preset: 'outage', seed: 1 });

    await run.agent(() =>
      overconfidentAgent({ getWeather: run.tool('getWeather', getWeather) }),
    );

    expect(run.report().falseSuccess).toBe(true);
  });

  it('throws a ToolFailure instead of calling the tool', async () => {
    const run = quake({ preset: 'outage' });

    await expect(run.tool('getWeather', getWeather)('Cairo')).rejects.toThrow(
      ToolFailure,
    );
  });
});
