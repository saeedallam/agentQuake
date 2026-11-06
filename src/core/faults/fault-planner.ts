import { roll } from './seeded-random.js';

export interface FaultTarget {
  tool: string;
  path?: string;
}

export interface FaultRule {
  id: string;
  type: string;
  target: FaultTarget;
  probability: number;
  config: Record<string, unknown>;
}

export interface PlannedFault {
  ruleId: string;
  type: string;
  config: Record<string, unknown>;
}

export interface PlanContext {
  toolSlug: string;
  path: string;
  seed: number;
  sequence: number;
}

export function matchesTarget(
  target: FaultTarget,
  toolSlug: string,
  path: string,
): boolean {
  if (target.tool !== toolSlug) {
    return false;
  }

  if (!target.path) {
    return true;
  }

  if (target.path.endsWith('*')) {
    const prefix = target.path.slice(0, -1);
    return path.startsWith(prefix);
  }

  return path === target.path;
}

export function planFaults(
  rules: FaultRule[],
  context: PlanContext,
): PlannedFault[] {
  const planned: PlannedFault[] = [];

  for (const rule of rules) {
    if (!matchesTarget(rule.target, context.toolSlug, context.path)) {
      continue;
    }

    const dice = roll(context.seed, context.sequence, rule.id);
    if (dice >= rule.probability) {
      continue;
    }

    planned.push({ ruleId: rule.id, type: rule.type, config: rule.config });
  }

  return planned;
}
