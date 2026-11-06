import type { JsonValue } from './json-value.js';

export type FaultOutcome =
  { kind: 'continue' } | { kind: 'respond'; status: number; body: string };

export interface FaultPlugin {
  readonly type: string;
  apply(config: Record<string, unknown>): Promise<FaultOutcome>;
  corrupt?(value: JsonValue, config: Record<string, unknown>): JsonValue;
  validateConfig?(config: Record<string, unknown>): string[];
}

export function actsAfterCall(plugin: FaultPlugin): boolean {
  return typeof plugin.corrupt === 'function';
}
