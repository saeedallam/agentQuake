import { z } from 'zod';
import type { FaultOutcome, FaultPlugin } from './fault.js';
import { configIssues } from './fault-config.js';
import { blank, emptyLists, type JsonValue } from './json-value.js';

const configSchema = z.object({
  mode: z.enum(['blank', 'no-results']).default('blank'),
});

export class EmptyResponseFault implements FaultPlugin {
  readonly type = 'empty_response';

  async apply(): Promise<FaultOutcome> {
    return { kind: 'continue' };
  }

  corrupt(value: JsonValue, config: Record<string, unknown>): JsonValue {
    const { mode } = configSchema.parse(config);
    return mode === 'no-results' ? emptyLists(value) : blank(value);
  }

  validateConfig(config: Record<string, unknown>): string[] {
    return configIssues(configSchema, config);
  }
}
