import type { FaultOutcome, FaultPlugin } from './fault.js';
import { sleep } from './sleep.js';

export class TimeoutFault implements FaultPlugin {
  readonly type = 'timeout';

  async apply(config: Record<string, unknown>): Promise<FaultOutcome> {
    const afterMs = Number(config.afterMs ?? 30_000);

    await sleep(afterMs);

    return {
      kind: 'respond',
      status: 504,
      body: JSON.stringify({ error: 'TIMEOUT' }),
    };
  }
}
