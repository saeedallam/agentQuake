import { QuakeConfigError, resolveRules } from './resolve-rules.js';

const TYPES = ['latency', 'http_error', 'timeout'];

describe('resolveRules', () => {
  it('returns no rules without a preset or faults', () => {
    expect(resolveRules({}, TYPES)).toEqual([]);
  });

  it('puts preset rules first, then faults with defaults filled in', () => {
    const rules = resolveRules(
      {
        preset: 'outage',
        faults: [
          { id: 'slow-email', type: 'latency', target: { tool: 'sendEmail' } },
        ],
      },
      TYPES,
    );

    expect(rules).toEqual([
      expect.objectContaining({ id: 'outage', target: { tool: '*' } }),
      {
        id: 'slow-email',
        type: 'latency',
        target: { tool: 'sendEmail' },
        probability: 1,
        config: {},
      },
    ]);
  });

  it('lists every problem at once', () => {
    const resolve = () =>
      resolveRules(
        {
          faults: [
            { id: 'a', type: 'slow_dns', target: { tool: 'x' } },
            { id: 'a', type: 'latency', target: { tool: 'x' } },
          ],
        },
        TYPES,
      );

    expect(resolve).toThrow(QuakeConfigError);
    try {
      resolve();
    } catch (error) {
      expect((error as QuakeConfigError).issues).toEqual([
        expect.objectContaining({ path: 'faults.0.type' }),
        expect.objectContaining({ path: 'faults.1.id' }),
      ]);
    }
  });

  it('rejects an unknown preset and an out-of-range probability', () => {
    expect(() =>
      resolveRules(
        {
          preset: 'chaos' as never,
          faults: [
            { id: 'a', type: 'latency', target: { tool: 'x' }, probability: 2 },
          ],
        },
        TYPES,
      ),
    ).toThrow(/preset[\s\S]*faults\.0\.probability/);
  });
});
