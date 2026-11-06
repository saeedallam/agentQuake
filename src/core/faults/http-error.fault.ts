import type { FaultOutcome, FaultPlugin } from './fault.js';

export class HttpErrorFault implements FaultPlugin {
  readonly type = 'http_error';

  async apply(config: Record<string, unknown>): Promise<FaultOutcome> {
    const status = Number(config.status ?? 503);

    return {
      kind: 'respond',
      status,
      body: JSON.stringify({ error: `HTTP ${status}` }),
    };
  }
}
