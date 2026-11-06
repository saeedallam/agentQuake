import type { ToolCallRecord } from './trace-store.js';

export interface CallSummary {
  injectedFaults: number;
  failedTools: string[];
  corruptedCount: number;
}

export function summarizeCalls(calls: ToolCallRecord[]): CallSummary {
  const lastCall = new Map<string, ToolCallRecord>();
  for (const call of calls) {
    lastCall.set(call.tool, call);
  }

  return {
    injectedFaults: calls.reduce(
      (total, call) => total + call.faults.length,
      0,
    ),
    failedTools: [...lastCall.values()]
      .filter((call) => !call.ok)
      .map((call) => call.tool),
    corruptedCount: calls.filter((call) => call.corrupted).length,
  };
}
