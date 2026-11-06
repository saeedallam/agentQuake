import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { quake } from '../library/quake.js';
import type { QuakeOptions } from '../library/resolve-rules.js';
import { startProxy } from './proxy.js';

let upstream: http.Server;
let upstreamUrl: string;
const received: { method?: string; url?: string; authorization?: string }[] =
  [];

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    received.push({
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
    });
    if (req.url?.startsWith('/broken')) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end('boom');
      return;
    }
    res
      .writeHead(200, { 'content-type': 'application/json' })
      .end('{"sunny":true}');
  });
  await new Promise<void>((resolve) =>
    upstream.listen(0, '127.0.0.1', resolve),
  );
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => upstream.close(resolve));
});

async function withProxy(
  options: QuakeOptions,
  test: (base: string, run: ReturnType<typeof quake>) => Promise<void>,
) {
  const run = quake({ seed: 1, ...options });
  const server = await startProxy({
    run,
    tools: new Map([
      ['weather', upstreamUrl],
      ['offline', 'http://127.0.0.1:1'],
    ]),
    port: 0,
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await test(base, run);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('startProxy', () => {
  it('forwards a request to the tool and records it by path', async () => {
    await withProxy({}, async (base, run) => {
      const response = await fetch(`${base}/weather/forecast?city=Cairo`, {
        headers: { authorization: 'Bearer secret' },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sunny: true });
      expect(received.at(-1)).toEqual({
        method: 'GET',
        url: '/forecast?city=Cairo',
        authorization: 'Bearer secret',
      });
      expect(run.report().calls[0]).toMatchObject({
        tool: 'weather',
        path: '/forecast',
        args: [{ method: 'GET', path: '/forecast', query: 'city=Cairo' }],
        ok: true,
      });
    });
  });

  it('answers with the fault instead of calling the tool', async () => {
    await withProxy({ preset: 'outage' }, async (base, run) => {
      const before = received.length;
      const response = await fetch(`${base}/weather/forecast`);

      expect(response.status).toBe(503);
      expect(received).toHaveLength(before);
      expect(run.report().failedTools).toEqual(['weather']);
    });
  });

  it('matches fault targets against the path', async () => {
    await withProxy(
      {
        faults: [
          {
            id: 'forecast-down',
            type: 'http_error',
            target: { tool: 'weather', path: '/forecast*' },
          },
        ],
      },
      async (base) => {
        expect((await fetch(`${base}/weather/current`)).status).toBe(200);
        expect((await fetch(`${base}/weather/forecast`)).status).toBe(503);
      },
    );
  });

  it('records server errors as failed calls and passes them on', async () => {
    await withProxy({}, async (base, run) => {
      const response = await fetch(`${base}/weather/broken`);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('boom');
      expect(run.report().calls[0]).toMatchObject({ ok: false });
    });
  });

  it('answers 502 when the tool cannot be reached and 404 for unknown tools', async () => {
    await withProxy({}, async (base) => {
      expect((await fetch(`${base}/offline/anything`)).status).toBe(502);
      const unknown = await fetch(`${base}/email/send`);
      expect(unknown.status).toBe(404);
      expect(await unknown.json()).toEqual({
        error: 'TOOL_NOT_FOUND',
        tools: ['weather', 'offline'],
      });
    });
  });
});
