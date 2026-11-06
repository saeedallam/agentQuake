import { z } from 'zod';
import type { FaultOutcome, FaultPlugin } from './fault.js';
import { configIssues } from './fault-config.js';
import { truncate, type JsonValue } from './json-value.js';

const configSchema = z.object({
  keep: z.number().min(0).max(1).default(0.5),
});

export class TruncatedResponseFault implements FaultPlugin {
  readonly type = 'truncated_response';

  async apply(): Promise<FaultOutcome> {
    return { kind: 'continue' };
  }

  corrupt(value: JsonValue, config: Record<string, unknown>): JsonValue {
    const { keep } = configSchema.parse(config);
    return truncate(value, keep);
  }

  validateConfig(config: Record<string, unknown>): string[] {
    return configIssues(configSchema, config);
  }
}
