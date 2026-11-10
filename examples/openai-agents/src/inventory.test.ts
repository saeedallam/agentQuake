import { describe, expect, it } from 'vitest';
import { runInventoryAgent } from './inventory.js';

describe('OpenAI Agents SDK inventory example', () => {
  it.each(['naive', 'careful'] as const)(
    'answers with valid stock data (%s)',
    async (variant) => {
      const { answer } = await runInventoryAgent(variant);
      expect(answer).toBe('Stock for tea-01: 12 units.');
    },
  );

  // agentQuake marks the call as corrupted, but it can't know that `tea` is
  // the wrong SKU: only the agent's own validation can catch that.
  it('passes corrupt stock data through without validation', async () => {
    const { answer, report } = await runInventoryAgent('naive', 'silent');
    expect(report.corruptedCalls).toHaveLength(1);
    expect(answer).toBe('Stock for tea: 12 units.');
  });

  it('reports unavailable stock when validation catches the same fault', async () => {
    const { answer, report } = await runInventoryAgent('careful', 'silent');
    expect(report.corruptedCalls).toHaveLength(1);
    expect(answer).toBe(
      'Stock is unavailable because the tool returned invalid data.',
    );
  });
});
