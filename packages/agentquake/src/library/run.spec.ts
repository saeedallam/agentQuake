import { quake, ToolFailure } from '../index.js';

const add = (a: number, b: number) => a + b;

describe('Run.tool', () => {
  it('calls the real tool and records the call when no fault fires', async () => {
    const run = quake({ seed: 1 });

    await expect(run.tool('add', add)(2, 3)).resolves.toBe(5);
    expect(run.report().calls).toEqual([
      expect.objectContaining({
        sequence: 1,
        tool: 'add',
        args: [2, 3],
        ok: true,
        result: 5,
        faults: [],
      }),
    ]);
  });

  it('does not call the real tool when a fault responds', async () => {
    const run = quake({ preset: 'outage', seed: 1 });
    const realTool = vi.fn(add);

    const error = await run
      .tool('add', realTool)(2, 3)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ToolFailure);
    expect(error).toMatchObject({ tool: 'add', status: 503 });
    expect(realTool).not.toHaveBeenCalled();
  });

  it('only targets the named tool', async () => {
    const run = quake({
      faults: [
        { id: 'down', type: 'http_error', target: { tool: 'sendEmail' } },
      ],
    });

    await expect(run.tool('add', add)(1, 1)).resolves.toBe(2);
    await expect(run.tool('sendEmail', add)(1, 1)).rejects.toThrow(
      'Tool sendEmail failed with HTTP 503',
    );
  });

  it('records and rethrows errors from the real tool', async () => {
    const run = quake();
    const broken = run.tool('broken', () => {
      throw new Error('boom');
    });

    await expect(broken()).rejects.toThrow('boom');
    expect(run.report().calls[0]).toMatchObject({ ok: false, error: 'boom' });
  });

  it('injects the same faults for the same seed', async () => {
    const pattern = async (seed: number) => {
      const run = quake({ preset: 'flaky', seed });
      const tool = run.tool('add', add);
      for (let i = 0; i < 20; i += 1) {
        await tool(1, 1).catch(() => undefined);
      }
      return run.report().calls.map((call) => call.ok);
    };

    const first = await pattern(42);
    expect(await pattern(42)).toEqual(first);
    expect(first).toContain(true);
    expect(first).toContain(false);
  });
});

describe('Run.report', () => {
  it('leaves falseSuccess null when run.agent was not used', () => {
    expect(quake().report().falseSuccess).toBeNull();
  });

  it('lists a tool whose last call failed', async () => {
    const run = quake({
      faults: [
        {
          id: 'first-call-fails',
          type: 'http_error',
          target: { tool: 'add' },
          probability: 1,
        },
      ],
      seed: 1,
    });
    const tool = run.tool('add', add);
    await tool(1, 1).catch(() => undefined);

    expect(run.report().failedTools).toEqual(['add']);
  });

  it('is not a false success when the agent throws', async () => {
    const run = quake({ preset: 'outage' });

    await expect(
      run.agent(async () => run.tool('add', add)(1, 1)),
    ).rejects.toThrow(ToolFailure);
    expect(run.report().falseSuccess).toBe(false);
  });

  it('accepts a custom admitsFailure check', async () => {
    const run = quake({ preset: 'outage' });

    await run.agent(async () => {
      await run
        .tool('add', add)(1, 1)
        .catch(() => undefined);
      return { status: 'error' };
    });

    expect(run.report().falseSuccess).toBe(false);
    expect(run.report({ admitsFailure: () => false }).falseSuccess).toBe(true);
  });

  it('shows the seed so a run can be replayed', () => {
    expect(quake({ seed: 7 }).report().seed).toBe(7);
  });
});
