import { quake } from '../index.js';

type Outcome = 'ok' | 'fail';

async function scriptedRun(
  steps: [tool: string, outcome: Outcome, critical?: boolean][],
  answer = 'Done! It is sunny in Cairo.',
) {
  const run = quake();
  await run.agent(async () => {
    for (const [tool, outcome, critical] of steps) {
      const call = run.tool(
        tool,
        () => {
          if (outcome === 'fail') {
            throw new Error(`${tool} is down`);
          }
          return { tool };
        },
        { critical },
      );
      await call().catch(() => undefined);
    }
    return answer;
  });
  return run.report();
}

describe('falseSuccess without critical tools', () => {
  it('is false after a fallback to another tool', async () => {
    const report = await scriptedRun([
      ['weatherA', 'fail'],
      ['weatherB', 'ok'],
    ]);
    expect(report.falseSuccess).toBe(false);
    expect(report.failedTools).toEqual(['weatherA']);
  });

  it('is false after a retry that worked', async () => {
    const report = await scriptedRun([
      ['getWeather', 'fail'],
      ['getWeather', 'ok'],
    ]);
    expect(report.falseSuccess).toBe(false);
  });

  it('is true when the last failure was never followed by a success', async () => {
    const report = await scriptedRun([
      ['getTime', 'ok'],
      ['getWeather', 'fail'],
    ]);
    expect(report.falseSuccess).toBe(true);
    expect(report.unrecoveredTools).toEqual(['getWeather']);
  });

  it('is false when the answer admits the failure', async () => {
    const report = await scriptedRun(
      [['getWeather', 'fail']],
      'Sorry, the weather service is unavailable.',
    );
    expect(report.falseSuccess).toBe(false);
  });

  it('cannot tell an unrelated success from a fallback (mark critical tools for that)', async () => {
    const report = await scriptedRun([
      ['getWeather', 'fail'],
      ['getTime', 'ok'],
    ]);
    expect(report.falseSuccess).toBe(false);
  });
});

describe('falseSuccess with critical tools', () => {
  it('is true when a critical tool failed, even if other tools worked after it', async () => {
    const report = await scriptedRun([
      ['getWeather', 'fail', true],
      ['getTime', 'ok'],
    ]);
    expect(report.falseSuccess).toBe(true);
    expect(report.unrecoveredTools).toEqual(['getWeather']);
  });

  it('is false when a critical tool worked after a retry', async () => {
    const report = await scriptedRun([
      ['bookFlight', 'fail', true],
      ['bookFlight', 'ok', true],
    ]);
    expect(report.falseSuccess).toBe(false);
  });

  it('is true when the last call of a critical tool failed after an earlier success', async () => {
    const report = await scriptedRun([
      ['bookFlight', 'ok', true],
      ['bookFlight', 'fail', true],
    ]);
    expect(report.falseSuccess).toBe(true);
  });

  it('ignores failures of tools that are not critical', async () => {
    const report = await scriptedRun([
      ['bookFlight', 'ok', true],
      ['sendEmail', 'fail'],
    ]);
    expect(report.falseSuccess).toBe(false);
    expect(report.unrecoveredTools).toEqual([]);
  });

  it('records which calls were critical', async () => {
    const report = await scriptedRun([['bookFlight', 'ok', true]]);
    expect(report.calls[0]).toMatchObject({ critical: true });
  });
});
