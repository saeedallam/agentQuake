import { summarizeCalls } from '../library/summary.js';
import type { ToolCallRecord } from '../library/trace-store.js';

export function formatReport(calls: ToolCallRecord[], seed?: number): string {
  const { injectedFaults, failedTools } = summarizeCalls(calls);
  const lines = [
    `Calls: ${calls.length}`,
    `Faults injected: ${injectedFaults}`,
    `Tools whose last call failed: ${failedTools.length > 0 ? failedTools.join(', ') : 'none'}`,
  ];
  if (seed !== undefined) {
    lines.push(`Seed: ${seed}`);
  }

  if (calls.length > 0) {
    lines.push('', ' #  tool / path                       result      faults');
    for (const call of calls) {
      const name = call.path ? `${call.tool} ${call.path}` : call.tool;
      const result = call.ok
        ? 'ok'
        : `failed${call.status ? ` ${call.status}` : ''}`;
      lines.push(
        `${String(call.sequence).padStart(2)}  ${name.padEnd(32).slice(0, 32)}  ${result.padEnd(10)}  ${call.faults.join(', ') || '-'}`,
      );
    }
  }

  return lines.join('\n');
}
