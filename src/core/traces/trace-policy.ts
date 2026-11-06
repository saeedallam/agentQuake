export const REDACTED = '[REDACTED]';
export const MAX_BODY_LENGTH = 64 * 1024;

const SENSITIVE_NAME = /auth|cookie|token|secret|password|session|api[-_]?key/i;

export function isSensitive(name: string): boolean {
  return SENSITIVE_NAME.test(name);
}

export function redactHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      isSensitive(name) ? REDACTED : value,
    ]),
  );
}

export function redactQuery(query: string | null): string | null {
  if (!query) {
    return query;
  }

  return query
    .split('&')
    .map((pair) => {
      const name = pair.split('=')[0];
      return isSensitive(name) ? `${name}=${REDACTED}` : pair;
    })
    .join('&');
}

export function truncateBody(body: string | null): {
  body: string | null;
  truncated: boolean;
} {
  if (body === null || body.length <= MAX_BODY_LENGTH) {
    return { body, truncated: false };
  }

  return { body: body.slice(0, MAX_BODY_LENGTH), truncated: true };
}
