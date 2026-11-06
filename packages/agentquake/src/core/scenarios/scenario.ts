import { parse as parseYaml, YAMLParseError } from 'yaml';
import { z } from 'zod';
import { issuesFrom, slugSchema, type ValidationIssue } from '../validation.js';

const MAX_SEED = 2_147_483_647;

const faultRuleSchema = z.object({
  id: slugSchema,
  type: z.string().min(1),
  target: z.object({
    tool: slugSchema,
    path: z.string().min(1).optional(),
  }),
  probability: z.number().min(0).max(1).default(1),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const scenarioSchema = z
  .object({
    version: z.literal(1),
    name: slugSchema,
    seed: z.int().min(0).max(MAX_SEED).optional(),
    faults: z.array(faultRuleSchema).default([]),
  })
  .superRefine((scenario, ctx) => {
    const seen = new Set<string>();
    scenario.faults.forEach((fault, index) => {
      if (seen.has(fault.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['faults', index, 'id'],
          message: `Duplicate fault id "${fault.id}"`,
        });
      }
      seen.add(fault.id);
    });
  });

export type Scenario = z.output<typeof scenarioSchema>;

export type ParseResult =
  { ok: true; scenario: Scenario } | { ok: false; issues: ValidationIssue[] };

export function parseScenario(
  sourceYaml: string,
  knownFaultTypes: string[],
  unsupportedFaultTypes: string[] = [],
): ParseResult {
  let raw: unknown;
  try {
    raw = parseYaml(sourceYaml);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const line = error.linePos?.[0]?.line;
      return {
        ok: false,
        issues: [
          {
            path: '',
            message: line
              ? `YAML syntax error on line ${line}: ${error.message}`
              : `YAML syntax error: ${error.message}`,
          },
        ],
      };
    }
    throw error;
  }

  const result = scenarioSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: issuesFrom(result.error) };
  }

  const unknownTypes: ValidationIssue[] = [];
  result.data.faults.forEach((fault, index) => {
    if (unsupportedFaultTypes.includes(fault.type)) {
      unknownTypes.push({
        path: `faults.${index}.type`,
        message: `"${fault.type}" is not supported here yet; use the agentquake library or CLI`,
      });
    } else if (!knownFaultTypes.includes(fault.type)) {
      unknownTypes.push({
        path: `faults.${index}.type`,
        message: `Unknown fault type "${fault.type}". Known types: ${knownFaultTypes.join(', ')}`,
      });
    }
  });
  if (unknownTypes.length > 0) {
    return { ok: false, issues: unknownTypes };
  }

  return { ok: true, scenario: result.data };
}
