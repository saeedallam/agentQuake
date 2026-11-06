import { LatencyFault } from './latency.fault.js';

describe('LatencyFault', () => {
  it('waits for delayMs and then tells the proxy to continue', async () => {
    const fault = new LatencyFault();
    const startedAt = Date.now();

    const outcome = await fault.apply({ delayMs: 50 });

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(45);
    expect(outcome).toEqual({ kind: 'continue' });
  });
});
