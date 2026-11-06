import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { FaultRuleInput, QuakeOptions } from '../library/resolve-rules.js';
import type { PresetName } from '../library/presets.js';

export interface ScenarioFlags {
  preset?: string;
  scenario?: string;
  seed?: string;
}

export class CliError extends Error {}

export function quakeOptionsFrom(flags: ScenarioFlags): QuakeOptions {
  const options: QuakeOptions = {};

  if (flags.preset) {
    options.preset = flags.preset as PresetName;
  }

  if (flags.scenario) {
    const scenario = readScenario(flags.scenario);
    options.faults = scenario.faults;
    options.seed = scenario.seed;
  }

  if (flags.seed !== undefined) {
    const seed = Number(flags.seed);
    if (!Number.isInteger(seed) || seed < 0) {
      throw new CliError(`--seed must be a whole number, got "${flags.seed}"`);
    }
    options.seed = seed;
  }

  return options;
}

function readScenario(file: string): {
  faults?: FaultRuleInput[];
  seed?: number;
} {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new CliError(`Cannot read the scenario file "${file}"`);
  }

  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (error) {
    throw new CliError(
      `The scenario file "${file}" is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new CliError(
      `The scenario file "${file}" must contain a mapping with "faults"`,
    );
  }

  const scenario = raw as { faults?: FaultRuleInput[]; seed?: number };
  return { faults: scenario.faults, seed: scenario.seed };
}
