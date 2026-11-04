export interface ToolCall {
  id: string | number;
  name: string;
  arguments: Record<string, unknown>;
}

export function readToolCall(message: unknown): ToolCall | null {
  if (
    typeof message !== 'object' ||
    message === null ||
    Array.isArray(message)
  ) {
    return null;
  }

  const envelope = message as Record<string, unknown>;
  if (envelope.method !== 'tools/call') {
    return null;
  }

  const id = envelope.id;
  if (typeof id !== 'string' && typeof id !== 'number') {
    return null;
  }

  const params = envelope.params;
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    return null;
  }

  const details = params as Record<string, unknown>;
  if (typeof details.name !== 'string') {
    return null;
  }

  const args = details.arguments;
  const safeArguments =
    typeof args === 'object' && args !== null && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : {};

  return { id, name: details.name, arguments: safeArguments };
}
