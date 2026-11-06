import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { Run } from '../library/run.js';
import { ToolFailure } from '../library/tool-failure.js';
import { FailedReply } from './failed-reply.js';

const HOP_BY_HOP = new Set([
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
  'content-encoding',
]);

export interface ProxyOptions {
  run: Run;
  tools: Map<string, string>;
  port: number;
  timeoutMs?: number;
  log?: (message: string) => void;
}

interface UpstreamReply {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
}

export async function startProxy(options: ProxyOptions): Promise<Server> {
  const { run, tools } = options;
  const log = options.log ?? (() => undefined);
  const timeoutMs = options.timeoutMs ?? 30_000;

  const server = createServer((req, res) => {
    handle(req).then(
      (reply) => {
        res.writeHead(reply.status, reply.headers).end(reply.body);
      },
      (error: unknown) => {
        log(error instanceof Error ? error.message : String(error));
        res.writeHead(500).end();
      },
    );
  });

  async function handle(req: IncomingMessage): Promise<UpstreamReply> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const [, toolName = '', ...rest] = url.pathname.split('/');
    const baseUrl = tools.get(toolName);
    if (!baseUrl) {
      return jsonReply(404, {
        error: 'TOOL_NOT_FOUND',
        tools: [...tools.keys()],
      });
    }

    const path = `/${rest.join('/')}`;
    const body = await readBody(req);
    const forward = run.tool(
      toolName,
      async (_request: { method: string; path: string; query: string }) => {
        const reply = await sendUpstream(
          `${baseUrl.replace(/\/$/, '')}${path}${url.search}`,
          req,
          body,
        );
        if (reply.status >= 500) {
          throw new FailedReply(reply, `HTTP ${reply.status}`);
        }
        return reply;
      },
      { path },
    );

    try {
      return await forward({
        method: req.method ?? 'GET',
        path,
        query: url.search.slice(1),
      });
    } catch (error) {
      if (error instanceof FailedReply) {
        return error.reply as UpstreamReply;
      }
      if (error instanceof ToolFailure) {
        log(`fault on ${toolName}${path}: HTTP ${error.status}`);
        return {
          status: error.status,
          headers: { 'content-type': 'application/json' },
          body: Buffer.from(error.body),
        };
      }
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      return jsonReply(timedOut ? 504 : 502, {
        error: timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE',
      });
    }
  }

  async function sendUpstream(
    target: string,
    req: IncomingMessage,
    body: Buffer | null,
  ): Promise<UpstreamReply> {
    const response = await fetch(target, {
      method: req.method,
      headers: forwardHeaders(req.headers),
      body: body ? new Uint8Array(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      if (!HOP_BY_HOP.has(name.toLowerCase())) {
        headers[name] = value;
      }
    });
    return {
      status: response.status,
      headers,
      body: new Uint8Array(await response.arrayBuffer()),
    };
  }

  await new Promise<void>((resolve) =>
    server.listen(options.port, '127.0.0.1', resolve),
  );
  return server;
}

function forwardHeaders(
  incoming: IncomingMessage['headers'],
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(incoming)) {
    if (value !== undefined && !HOP_BY_HOP.has(name.toLowerCase())) {
      headers[name] = Array.isArray(value) ? value.join(', ') : value;
    }
  }
  return headers;
}

async function readBody(req: IncomingMessage): Promise<Buffer | null> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return null;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks);
  return body.length > 0 ? body : null;
}

function jsonReply(status: number, body: unknown): UpstreamReply {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(JSON.stringify(body)),
  };
}
