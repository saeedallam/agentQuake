import 'dotenv/config';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

interface JsonRpcMessage {
  id?: number;
  method: string;
  params?: { name?: string };
}

const brokenForecastYaml = `version: 1
name: broken-mcp-forecast
faults:
  - id: forecast-down
    type: http_error
    target: { tool: weather, path: "get_forecast" }
    config: { status: 503 }
`;

describe('MCP proxy (e2e)', () => {
  let app: NestExpressApplication;
  let mcpServer: http.Server;
  let mcpUrl: string;
  const received: JsonRpcMessage[] = [];
  const project = `e2e-mcp-${Date.now()}`;

  beforeAll(async () => {
    mcpServer = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const message = JSON.parse(
        Buffer.concat(chunks).toString('utf8'),
      ) as JsonRpcMessage;
      received.push(message);

      const result =
        message.method === 'tools/list'
          ? { tools: [{ name: 'get_current' }, { name: 'get_forecast' }] }
          : { content: [{ type: 'text', text: 'Sunny, 30C' }] };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
    });
    await new Promise<void>((resolve) =>
      mcpServer.listen(0, '127.0.0.1', resolve),
    );
    const { port } = mcpServer.address() as AddressInfo;
    mcpUrl = `http://127.0.0.1:${port}/mcp`;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      rawBody: true,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => mcpServer.close(resolve));
  });

  it('injects a failed tool result into an MCP tool call', async () => {
    const server = app.getHttpServer();

    await request(server)
      .put(`/projects/${project}`)
      .send({ name: 'E2E MCP project' })
      .expect(200);
    await request(server)
      .put(`/projects/${project}/tools/weather`)
      .send({ baseUrl: mcpUrl })
      .expect(200);
    await request(server)
      .post(`/projects/${project}/scenarios`)
      .set('content-type', 'text/yaml')
      .send(brokenForecastYaml)
      .expect(201);
    const run = await request(server)
      .post(`/projects/${project}/scenarios/broken-mcp-forecast/runs`)
      .expect(201);
    const endpoint = `/mcp-proxy/${run.body.id}/weather`;

    const list = await request(server)
      .post(endpoint)
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      .expect(200);
    expect(list.body.result.tools).toHaveLength(2);

    const current = await request(server)
      .post(endpoint)
      .set('authorization', 'Bearer real-secret')
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'get_current', arguments: { city: 'Cairo' } },
      })
      .expect(200);
    expect(current.body).toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: { content: [{ type: 'text', text: 'Sunny, 30C' }] },
    });

    const forecast = await request(server)
      .post(endpoint)
      .send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'get_forecast', arguments: { city: 'Cairo' } },
      })
      .expect(200);
    expect(forecast.body).toMatchObject({
      jsonrpc: '2.0',
      id: 3,
      result: { isError: true },
    });

    expect(received.map((message) => message.method)).toEqual([
      'tools/list',
      'tools/call',
    ]);

    const traces = await request(server)
      .get(`/runs/${run.body.id}/traces`)
      .expect(200);
    expect(traces.body).toHaveLength(2);
    expect(traces.body[0]).toMatchObject({
      sequence: 1,
      method: 'tools/call',
      path: 'get_current',
      responseStatus: 200,
      faults: [],
    });
    expect(traces.body[0].requestHeaders.authorization).toBe('[REDACTED]');
    expect(traces.body[1]).toMatchObject({
      sequence: 2,
      method: 'tools/call',
      path: 'get_forecast',
      upstreamDurationMs: null,
      faults: [{ ruleId: 'forecast-down', type: 'http_error' }],
    });
  });
});
