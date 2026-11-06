import { isJsonValue, type JsonValue } from '../core/faults/json-value.js';
import type { ResultPayload } from '../library/payload.js';

export interface HttpReply {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
}

type BodyKind = 'json' | 'text' | 'other';

function bodyKind(reply: HttpReply): BodyKind {
  const contentType = (reply.headers['content-type'] ?? '').toLowerCase();
  if (contentType.includes('json')) {
    return 'json';
  }
  if (
    contentType.startsWith('text/') &&
    !contentType.includes('event-stream')
  ) {
    return 'text';
  }
  return 'other';
}

function parseJson(text: string): JsonValue | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return isJsonValue(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export const httpPayload: ResultPayload<HttpReply> = {
  decode(reply) {
    if (reply.status >= 400) {
      return undefined;
    }
    const text = Buffer.from(reply.body).toString('utf8');
    const kind = bodyKind(reply);
    if (kind === 'json') {
      return parseJson(text);
    }
    return kind === 'text' ? text : undefined;
  },

  encode(reply, value) {
    const text =
      bodyKind(reply) === 'text' && typeof value === 'string'
        ? value
        : JSON.stringify(value);
    return { ...reply, body: Buffer.from(text) };
  },
};

interface McpContentItem {
  type?: unknown;
  text?: unknown;
}

interface McpReply {
  result?: {
    structuredContent?: unknown;
    content?: McpContentItem[];
  };
}

function readReply(line: string): McpReply | undefined {
  try {
    const message: unknown = JSON.parse(line);
    return typeof message === 'object' && message !== null
      ? (message as McpReply)
      : undefined;
  } catch {
    return undefined;
  }
}

function firstText(reply: McpReply): McpContentItem | undefined {
  return reply.result?.content?.find(
    (item) => item.type === 'text' && typeof item.text === 'string',
  );
}

export const mcpPayload: ResultPayload<string | null> = {
  decode(line) {
    const reply = line === null ? undefined : readReply(line);
    if (!reply?.result) {
      return undefined;
    }

    const structured = reply.result.structuredContent;
    if (structured !== undefined) {
      return isJsonValue(structured) ? structured : undefined;
    }

    const text = firstText(reply)?.text;
    if (typeof text !== 'string') {
      return undefined;
    }
    return parseJson(text) ?? text;
  },

  encode(line, value) {
    const reply = line === null ? undefined : readReply(line);
    if (!reply?.result) {
      return line;
    }

    const structured = reply.result.structuredContent;
    if (structured !== undefined) {
      const before = JSON.stringify(structured);
      reply.result.structuredContent = value;
      for (const item of reply.result.content ?? []) {
        if (typeof item.text === 'string' && sameJson(item.text, before)) {
          item.text = JSON.stringify(value);
        }
      }
      return JSON.stringify(reply);
    }

    const item = firstText(reply);
    if (item && typeof item.text === 'string') {
      item.text =
        parseJson(item.text) === undefined && typeof value === 'string'
          ? value
          : JSON.stringify(value);
    }
    return JSON.stringify(reply);
  },
};

function sameJson(text: string, serialized: string): boolean {
  const parsed = parseJson(text);
  return parsed !== undefined && JSON.stringify(parsed) === serialized;
}
