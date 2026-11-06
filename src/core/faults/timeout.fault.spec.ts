import { TimeoutFault } from './timeout.fault.js';

describe('TimeoutFault', () => {
  it('waits for afterMs and then answers 504 instead of the tool', async () => {
    const startedAt = Date.now();

    const outcome = await new TimeoutFault().apply({ afterMs: 50 });

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(45);
    expect(outcome).toEqual({
      kind: 'respond',
      status: 504,
      body: '{"error":"TIMEOUT"}',
    });
  });
});
