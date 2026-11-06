export type FaultOutcome =
  { kind: 'continue' } | { kind: 'respond'; status: number; body: string };

export interface FaultPlugin {
  readonly type: string;
  apply(config: Record<string, unknown>): Promise<FaultOutcome>;
}
