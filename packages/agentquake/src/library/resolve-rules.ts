import { z } from 'zod';
import type { FaultRule } from '../core/faults/fault-planner.js';
import { issuesFrom, type ValidationIssue } from '../core/validation.js';
import { PRESET_NAMES, PRESETS, type PresetName } from './presets.js';
import type { TraceStore } from './trace-store.js';

export interface QuakeOptions {
  preset?: PresetName;
  faults?: FaultRuleInput[];
  seed?: number;
  store?: TraceStore;
}

const faultRuleSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  target: z.object({
    tool: z.string().min(1),
    path: z.string().min(1).optional(),
  }),
  probability: z.number().min(0).max(1).default(1),
  config: z.record(z.string(), z.unknown()).default({}),
});

export type FaultRuleInput = z.input<typeof faultRuleSchema>;

export class QuakeConfigError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(
      `Invalid agentquake options:\n${issues
        .map((issue) => `  - ${issue.path || '(root)'}: ${issue.message}`)
        .join('\n')}`,
    );
    this.name = 'QuakeConfigError';
  }
}

const optionsSchema = z.object({
  preset: z.enum(PRESET_NAMES).optional(),
  faults: z.array(faultRuleSchema).default([]),
  seed: z.int().min(0).max(2_147_483_647).optional(),
});

export function resolveRules(
  options: QuakeOptions,
  faultTypes: string[],
): FaultRule[] {
  const parsed = optionsSchema.safeParse(options);
  if (!parsed.success) {
    throw new QuakeConfigError(issuesFrom(parsed.error));
  }

  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  parsed.data.faults.forEach((rule, index) => {
    if (seen.has(rule.id)) {
      issues.push({
        path: `faults.${index}.id`,
        message: `Duplicate fault id "${rule.id}"`,
      });
    }
    seen.add(rule.id);

    if (!faultTypes.includes(rule.type)) {
      issues.push({
        path: `faults.${index}.type`,
        message: `Unknown fault type "${rule.type}". Use one of: ${faultTypes.join(', ')}`,
      });
    }
  });
  if (issues.length > 0) {
    throw new QuakeConfigError(issues);
  }

  const presetRules = parsed.data.preset ? PRESETS[parsed.data.preset] : [];
  return [...presetRules, ...parsed.data.faults];
}
