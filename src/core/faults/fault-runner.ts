import type { FaultOutcome } from './fault.js';
import type { PlannedFault } from './fault-planner.js';
import type { FaultRegistry } from './fault-registry.js';

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
