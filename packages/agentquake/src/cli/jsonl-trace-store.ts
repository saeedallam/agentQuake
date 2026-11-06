import { appendFileSync, writeFileSync } from 'node:fs';
import {
  MemoryTraceStore,
  type ToolCallRecord,
} from '../library/trace-store.js';

export class JsonlTraceStore extends MemoryTraceStore {
  constructor(
    private readonly file: string,
    private readonly seed: number,
  ) {
    super();
    writeFileSync(file, '');
  }

  override record(call: ToolCallRecord): void {
    super.record(call);
    appendFileSync(
      this.file,
      `${JSON.stringify({ seed: this.seed, ...call })}\n`,
    );
  }
}

export function parseJsonl(text: string): ToolCallRecord[] {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as ToolCallRecord);
}
