import { z } from 'zod';

export interface ValidationIssue {
  path: string;
  message: string;
}

export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    'Use lowercase letters, numbers and dashes, like "weather-api"',
  );

export function issuesFrom(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
