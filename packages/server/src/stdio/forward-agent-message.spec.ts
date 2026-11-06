import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { forwardAgentMessage } from './forward-agent-message.js';

const toolCall = JSON.stringify({
  jsonrpc: '2.0',
  id: 7,
  method: 'tools/call',
  params: { name: 'get_forecast' },
});
const notification = JSON.stringify({
  jsonrpc: '2.0',
  method: 'notifications/initialized',
});

let server: http.Server;
let baseUrl: string;
const received: { contentType?: string; body: string }[] = [];

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    received.push({
      contentType: req.headers['content-type'],
      body: Buffer.concat(chunks).toString('utf8'),
    });

    if (req.url === '/reply') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"jsonrpc":"2.0","id":7,"result":{}}\n');
    } else if (req.url === '/empty') {
      res.writeHead(202);
      res.end();
    } else {
      res.writeHead(409, { 'content-type': 'application/json' });
      res.end('{"error":"RUN_NOT_RUNNING"}');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('forwardAgentMessage', () => {
  it('posts the line as JSON and returns the reply as one line', async () => {
    const reply = await forwardAgentMessage(toolCall, `${baseUrl}/reply`);

    expect(reply).toBe('{"jsonrpc":"2.0","id":7,"result":{}}');
    expect(received.at(-1)).toEqual({
      contentType: 'application/json',
      body: toolCall,
    });
  });

  it('returns null when the reply is empty', async () => {
    expect(await forwardAgentMessage(notification, `${baseUrl}/empty`)).toBe(
      null,
    );
  });

  it('answers a JSON-RPC error with the same id when the proxy fails', async () => {
    const reply = await forwardAgentMessage(toolCall, `${baseUrl}/closed-run`);

    expect(JSON.parse(reply ?? '')).toEqual({
      jsonrpc: '2.0',
      id: 7,
      error: {
        code: -32603,
        message: 'agentquake could not deliver the message: HTTP 409',
      },
    });
  });

  it('answers a JSON-RPC error when the proxy is not reachable', async () => {
    const reply = await forwardAgentMessage(toolCall, 'http://127.0.0.1:1/');

    expect(JSON.parse(reply ?? '')).toMatchObject({
      id: 7,
      error: { code: -32603 },
    });
  });

  it('stays silent when a notification cannot be delivered', async () => {
    expect(
      await forwardAgentMessage(notification, `${baseUrl}/closed-run`),
    ).toBe(null);
  });
});
