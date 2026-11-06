import type { Request } from 'express';

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

export async function readRequestBody(
  req: Request & { rawBody?: Buffer },
): Promise<Buffer | null> {
  if (METHODS_WITHOUT_BODY.has(req.method)) {
    return null;
  }

  if (Buffer.isBuffer(req.rawBody)) {
    return req.rawBody.length > 0 ? req.rawBody : null;
  }

  if (req.readableEnded) {
    return null;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks);
  return body.length > 0 ? body : null;
}
