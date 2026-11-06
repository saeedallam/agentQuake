import { actsAfterCall, type FaultOutcome } from './fault.js';
import type { PlannedFault } from './fault-planner.js';
import type { FaultRegistry } from './fault-registry.js';
import type { JsonValue } from './json-value.js';

export interface FaultRun {
  applied: PlannedFault[];
  outcome: FaultOutcome;
}

export async function runFaults(
  planned: PlannedFault[],
  registry: FaultRegistry,
): Promise<FaultRun> {
  const applied: PlannedFault[] = [];

  for (const fault of planned) {
    const plugin = registry.get(fault.type);
    if (!plugin) {
      continue;
    }

    const outcome = await plugin.apply(fault.config);
    applied.push(fault);

    if (outcome.kind === 'respond') {
      return { applied, outcome };
    }
  }

  return { applied, outcome: { kind: 'continue' } };
}

export interface Corruption {
  value: JsonValue;
  corruptedBy: string[];
}

export function corruptResult(
  value: JsonValue,
  applied: PlannedFault[],
  registry: FaultRegistry,
): Corruption {
  let current = value;
  const corruptedBy: string[] = [];

  for (const fault of applied) {
    const plugin = registry.get(fault.type);
    if (!plugin?.corrupt) {
      continue;
    }

    const next = plugin.corrupt(current, fault.config);
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      corruptedBy.push(fault.ruleId);
      current = next;
    }
  }

  return { value: current, corruptedBy };
}

export function beforeCallFaults(
  applied: PlannedFault[],
  registry: FaultRegistry,
): string[] {
  return applied
    .filter((fault) => {
      const plugin = registry.get(fault.type);
      return plugin !== undefined && !actsAfterCall(plugin);
    })
    .map((fault) => fault.ruleId);
}
