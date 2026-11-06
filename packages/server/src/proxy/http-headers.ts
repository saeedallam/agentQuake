const NOT_FORWARDED = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const NOT_RETURNED = new Set([...NOT_FORWARDED, 'content-encoding']);

export function requestHeadersToForward(
  incoming: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(incoming)) {
    const key = name.toLowerCase();
    if (value === undefined || NOT_FORWARDED.has(key)) {
      continue;
    }
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return headers;
}

export function responseHeadersToReturn(
  upstream: Headers,
): Record<string, string> {
  const headers: Record<string, string> = {};
  upstream.forEach((value, name) => {
    if (!NOT_RETURNED.has(name.toLowerCase())) {
      headers[name.toLowerCase()] = value;
    }
  });
  return headers;
}
