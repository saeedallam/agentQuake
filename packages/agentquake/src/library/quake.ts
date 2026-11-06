import { FaultRegistry } from '../core/faults/fault-registry.js';
import { resolveRules, type QuakeOptions } from './resolve-rules.js';
import { Run } from './run.js';

const MAX_SEED = 2_147_483_647;

export function quake(options: QuakeOptions = {}): Run {
  const registry = new FaultRegistry();
  const rules = resolveRules(options, registry.types());
  const seed = options.seed ?? Math.floor(Math.random() * MAX_SEED);

  return new Run(rules, seed, registry, options.store);
}
