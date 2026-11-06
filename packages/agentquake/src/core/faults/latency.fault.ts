import type { FaultOutcome, FaultPlugin } from './fault.js';
import { sleep } from './sleep.js';

export class LatencyFault implements FaultPlugin {
  readonly type = 'latency';

  async apply(config: Record<string, unknown>): Promise<FaultOutcome> {
    const delayMs = Number(config.delayMs ?? 1000);

    await sleep(delayMs);

    return { kind: 'continue' };
  }
}
