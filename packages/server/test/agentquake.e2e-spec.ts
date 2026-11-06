import 'dotenv/config';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

interface ReceivedRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  body: string;
}

const brokenForecastYaml = `version: 1
name: broken-forecast
faults:
  - id: forecast-down
    type: http_error
    target: { tool: weather, path: "/forecast*" }
    config: { status: 503 }
`;

describe('agentquake (e2e)', () => {
  let app: NestExpressApplication;
  let upstream: http.Server;
  let upstreamUrl: string;
  const received: ReceivedRequest[] = [];
  const project = `e2e-${Date.now()}`;

  beforeAll(async () => {
    upstream = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      received.push({
        method: req.method ?? '',
        url: req.url ?? '',
        authorization: req.headers.authorization,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      res.writeHead(200, {
        'content-type': 'application/json',
        'retry-after': '1',
      });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', resolve),
    );
    const { port } = upstream.address() as AddressInfo;
    upstreamUrl = `http://127.0.0.1:${port}`;

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
    await new Promise((resolve) => upstream.close(resolve));
  });

  it('runs a scenario from setup to traces', async () => {
    const server = app.getHttpServer();

    await request(server)
      .put(`/projects/${project}`)
      .send({ name: 'E2E project' })
      .expect(200);
    await request(server)
      .put(`/projects/${project}/tools/weather`)
      .send({ baseUrl: upstreamUrl })
      .expect(200);
    await request(server)
      .post(`/projects/${project}/scenarios`)
      .set('content-type', 'text/yaml')
      .send(brokenForecastYaml)
      .expect(201);
    const run = await request(server)
      .post(`/projects/${project}/scenarios/broken-forecast/runs`)
      .send({ seed: 7 })
      .expect(201);
    const proxy = run.body.proxyBaseUrl as string;

    await request(server)
      .post(`${proxy}/weather/current?city=Cairo&api_key=sk_live_123`)
      .set('authorization', 'Bearer real-secret')
      .send({ units: 'metric' })
      .expect(200)
      .expect('retry-after', '1');
    await request(server).get(`${proxy}/weather/forecast`).expect(503);

    expect(received).toEqual([
      {
        method: 'POST',
        url: '/current?city=Cairo&api_key=sk_live_123',
        authorization: 'Bearer real-secret',
        body: '{"units":"metric"}',
      },
    ]);

    const traces = await request(server)
      .get(`/runs/${run.body.id}/traces`)
      .expect(200);
    expect(traces.body).toHaveLength(2);
    expect(traces.body[0]).toMatchObject({
      sequence: 1,
      method: 'POST',
      path: '/current',
      query: 'city=Cairo&api_key=[REDACTED]',
      responseStatus: 200,
      errorCode: null,
      faults: [],
    });
    expect(traces.body[0].requestHeaders.authorization).toBe('[REDACTED]');
    expect(traces.body[1]).toMatchObject({
      sequence: 2,
      path: '/forecast',
      responseStatus: 503,
      upstreamDurationMs: null,
      faults: [{ ruleId: 'forecast-down', type: 'http_error' }],
    });

    await request(server).post(`/runs/${run.body.id}/complete`).expect(201);
    await request(server).get(`${proxy}/weather/current`).expect(409);
  });

  it('explains what is wrong with an invalid scenario', async () => {
    const server = app.getHttpServer();

    const response = await request(server)
      .post(`/projects/${project}/scenarios`)
      .set('content-type', 'text/yaml')
      .send(brokenForecastYaml.replace('http_error', 'slow_dns'))
      .expect(400);

    expect(response.body.issues).toEqual([
      expect.objectContaining({ path: 'faults.0.type' }),
    ]);
  });

  it('rejects a scenario that targets a tool the project does not have', async () => {
    const server = app.getHttpServer();

    const response = await request(server)
      .post(`/projects/${project}/scenarios`)
      .set('content-type', 'text/yaml')
      .send(brokenForecastYaml.replace('tool: weather', 'tool: email'))
      .expect(400);

    expect(response.body.issues).toEqual([
      expect.objectContaining({ path: 'faults.0.target.tool' }),
    ]);
  });
});
