import { planFaults, type FaultRule } from '../core/faults/fault-planner.js';
import type { FaultRegistry } from '../core/faults/fault-registry.js';
import { runFaults } from '../core/faults/fault-runner.js';
import { summarizeCalls } from './summary.js';
import { ToolFailure } from './tool-failure.js';
import {
  MemoryTraceStore,
  type ToolCallRecord,
  type TraceStore,
} from './trace-store.js';

export interface QuakeReport {
  seed: number;
  calls: ToolCallRecord[];
  injectedFaults: number;
  failedTools: string[];
  answer: unknown;
  falseSuccess: boolean | null;
}

export interface ReportOptions {
  admitsFailure?: (answer: unknown) => boolean;
}

export interface ToolOptions {
  path?: string;
}

type AgentOutcome =
  | { state: 'not-run' }
  | { state: 'answered'; answer: unknown }
  | { state: 'threw' };

const FAILURE_WORDS =
  /\b(sorry|unable|couldn't|could not|can't|cannot|failed|failure|unavailable|not available|error)\b/i;

export function admitsFailureByWords(answer: unknown): boolean {
  const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
  return FAILURE_WORDS.test(text ?? '');
}

export class Run {
  private agentOutcome: AgentOutcome = { state: 'not-run' };

  constructor(
    private readonly rules: FaultRule[],
    readonly seed: number,
    private readonly registry: FaultRegistry,
    private readonly store: TraceStore = new MemoryTraceStore(),
  ) {}

  tool<Args extends unknown[], Result>(
    name: string,
    fn: (...args: Args) => Result,
    options: ToolOptions = {},
  ): (...args: Args) => Promise<Awaited<Result>> {
    return async (...args: Args): Promise<Awaited<Result>> => {
      const sequence = this.store.nextSequence();
      const startedAt = Date.now();

      const planned = planFaults(this.rules, {
        toolSlug: name,
        path: options.path ?? name,
        seed: this.seed,
        sequence,
      });
      const faultRun = await runFaults(planned, this.registry);
      const faults = faultRun.applied.map((fault) => fault.ruleId);
      const record = (outcome: Partial<ToolCallRecord> & { ok: boolean }) =>
        this.store.record({
          sequence,
          tool: name,
          ...(options.path === undefined ? {} : { path: options.path }),
          args,
          faults,
          durationMs: Date.now() - startedAt,
          ...outcome,
        });

      if (faultRun.outcome.kind === 'respond') {
        const failure = new ToolFailure(
          name,
          faultRun.outcome.status,
          faultRun.outcome.body,
        );
        record({ ok: false, status: failure.status, error: failure.message });
        throw failure;
      }

      try {
        const result = await fn(...args);
        record({ ok: true, result });
        return result;
      } catch (error) {
        record({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
  }

  async agent<Answer>(fn: () => Answer): Promise<Awaited<Answer>> {
    try {
      const answer = await fn();
      this.agentOutcome = { state: 'answered', answer };
      return answer;
    } catch (error) {
      this.agentOutcome = { state: 'threw' };
      throw error;
    }
  }

  report(options: ReportOptions = {}): QuakeReport {
    const admitsFailure = options.admitsFailure ?? admitsFailureByWords;
    const calls = this.store.calls();
    const { injectedFaults, failedTools } = summarizeCalls(calls);
    const answer =
      this.agentOutcome.state === 'answered'
        ? this.agentOutcome.answer
        : undefined;

    let falseSuccess: boolean | null = null;
    if (this.agentOutcome.state === 'threw') {
      falseSuccess = false;
    } else if (this.agentOutcome.state === 'answered') {
      falseSuccess = failedTools.length > 0 && !admitsFailure(answer);
    }

    return {
      seed: this.seed,
      calls,
      injectedFaults,
      failedTools,
      answer,
      falseSuccess,
    };
  }
}
