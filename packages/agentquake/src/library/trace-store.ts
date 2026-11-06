export interface ToolCallRecord {
  sequence: number;
  tool: string;
  path?: string;
  args: unknown[];
  faults: string[];
  ok: boolean;
  status?: number;
  result?: unknown;
  error?: string;
  durationMs: number;
}

export interface TraceStore {
  nextSequence(): number;
  record(call: ToolCallRecord): void;
  calls(): ToolCallRecord[];
}

export class MemoryTraceStore implements TraceStore {
  private readonly recorded: ToolCallRecord[] = [];
  private sequence = 0;

  nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  record(call: ToolCallRecord): void {
    this.recorded.push(call);
  }

  calls(): ToolCallRecord[] {
    return [...this.recorded];
  }
}
