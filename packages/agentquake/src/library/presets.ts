import { ANY_TOOL, type FaultRule } from '../core/faults/fault-planner.js';

export const PRESET_NAMES = [
  'flaky',
  'rate-limited',
  'slow',
  'outage',
  'silent',
] as const;

export type PresetName = (typeof PRESET_NAMES)[number];

function everyTool(
  id: string,
  type: string,
  probability: number,
  config: Record<string, unknown>,
): FaultRule {
  return { id, type, target: { tool: ANY_TOOL }, probability, config };
}

export const PRESETS: Record<PresetName, FaultRule[]> = {
  flaky: [everyTool('flaky', 'http_error', 0.3, { status: 503 })],
  'rate-limited': [
    everyTool('rate-limited', 'http_error', 0.5, { status: 429 }),
  ],
  slow: [everyTool('slow', 'latency', 0.5, { delayMs: 1000 })],
  outage: [everyTool('outage', 'http_error', 1, { status: 503 })],
  silent: [
    everyTool('silent-empty', 'empty_response', 0.3, { mode: 'no-results' }),
    everyTool('silent-truncated', 'truncated_response', 0.3, { keep: 0.5 }),
  ],
};
