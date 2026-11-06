import type { z } from 'zod';

export function configIssues(
  schema: z.ZodType,
  config: Record<string, unknown>,
): string[] {
  const result = schema.safeParse(config);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) =>
    issue.path.length > 0
      ? `${issue.path.join('.')}: ${issue.message}`
      : issue.message,
  );
}
