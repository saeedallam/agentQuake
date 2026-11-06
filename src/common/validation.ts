import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';
import { issuesFrom, type ValidationIssue } from '../core/validation.js';

export {
  issuesFrom,
  slugSchema,
  type ValidationIssue,
} from '../core/validation.js';

export function invalidInput(issues: ValidationIssue[]): BadRequestException {
  return new BadRequestException({ error: 'INVALID_INPUT', issues });
}

export function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw invalidInput(issuesFrom(result.error));
  }
  return result.data;
}
