import type { ToolCallRecord } from './trace-store.js';

export interface CallSummary {
  injectedFaults: number;
  failedTools: string[];
  corruptedCount: number;
}

export function summarizeCalls(calls: ToolCallRecord[]): CallSummary {
  return {
    injectedFaults: calls.reduce(
      (total, call) => total + call.faults.length,
      0,
    ),
    failedTools: failedLastCalls(calls),
    corruptedCount: calls.filter((call) => call.corrupted).length,
  };
}

export function unrecoveredTools(calls: ToolCallRecord[]): string[] {
  const critical = calls.filter((call) => call.critical);
  if (critical.length > 0) {
    return failedLastCalls(critical);
  }

  const tools = calls
    .filter(
      (call, index) =>
        !call.ok && !calls.slice(index + 1).some((later) => later.ok),
    )
    .map((call) => call.tool);
  return [...new Set(tools)];
}

function failedLastCalls(calls: ToolCallRecord[]): string[] {
  const lastCall = new Map<string, ToolCallRecord>();
  for (const call of calls) {
    lastCall.set(call.tool, call);
  }
  return [...lastCall.values()]
    .filter((call) => !call.ok)
    .map((call) => call.tool);
}
