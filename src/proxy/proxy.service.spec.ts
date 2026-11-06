import type { FaultOutcome, FaultPlugin } from '../core/faults/fault.js';
import type { FaultRule } from '../core/faults/fault-planner.js';
import type { FaultRegistry } from '../core/faults/fault-registry.js';
import type { TraceRecorder } from '../traces/trace.recorder.js';
import { ProxyService, type ProxyRequest } from './proxy.service.js';
import type { RunInfo, TargetProvider, ToolInfo } from './target.provider.js';
import { UpstreamError, type UpstreamClient } from './upstream.client.js';

const RUN_ID = '00000000-0000-7000-8000-000000000001';

const runningRun: RunInfo = {
  id: RUN_ID,
  status: 'RUNNING',
  projectId: 'project-1',
  seed: 42,
  faultRules: [],
};

const todosTool: ToolInfo = {
  id: 'tool-1',
  baseUrl: 'http://upstream.test',
  timeoutMs: 1000,
};

const okResponse = {
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: '{"id":1}',
  durationMs: 7,
};

const getTodo: ProxyRequest = {
  runId: RUN_ID,
  toolSlug: 'todos',
  method: 'GET',
  path: '/todos/1',
  query: 'expand=true',
  headers: { authorization: 'Bearer secret' },
  body: null,
};

function alwaysRule(type: string): FaultRule {
  return {
    id: `always-${type}`,
    type,
    target: { tool: 'todos' },
    probability: 1,
    config: {},
  };
}

function fakeCard(type: string, outcome: FaultOutcome) {
  const apply = vi.fn().mockResolvedValue(outcome);
  return { card: { type, apply } as FaultPlugin, apply };
}

function makeService(options: {
  run?: RunInfo | null;
  tool?: ToolInfo | null;
  send?: UpstreamClient['send'];
  cards?: FaultPlugin[];
}) {
  const targets = {
    findRun: vi.fn().mockResolvedValue(options.run ?? null),
    findTool: vi.fn().mockResolvedValue(options.tool ?? null),
  } as unknown as TargetProvider;
  const send = options.send ?? vi.fn().mockResolvedValue(okResponse);
  const upstream = { send } as unknown as UpstreamClient;
  const record = vi.fn().mockResolvedValue(undefined);
  const recorder = {
    nextSequence: vi.fn().mockResolvedValue(1),
    record,
  } as unknown as TraceRecorder;
  const cards = options.cards ?? [];
  const registry = {
    get: (type: string) => cards.find((card) => card.type === type),
  } as unknown as FaultRegistry;

  return {
    service: new ProxyService(targets, upstream, recorder, registry),
    send,
    record,
  };
}

describe('ProxyService', () => {
  it('returns 404 when the run does not exist', async () => {
    const { service } = makeService({ run: null });

    const result = await service.forward(getTodo);

    expect(result.status).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ error: 'RUN_NOT_FOUND' });
  });

  it('returns 409 when the run is not running', async () => {
    const { service } = makeService({
      run: { ...runningRun, status: 'COMPLETED' },
    });

    const result = await service.forward(getTodo);

    expect(result.status).toBe(409);
    expect(JSON.parse(result.body)).toEqual({ error: 'RUN_NOT_RUNNING' });
  });

  it('returns 404 when the tool does not exist', async () => {
    const { service, record } = makeService({ run: runningRun, tool: null });

    const result = await service.forward({ ...getTodo, toolSlug: 'email' });

    expect(result.status).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ error: 'TOOL_NOT_FOUND' });
    expect(record).not.toHaveBeenCalled();
  });

  it('forwards the full request to the tool and records a trace', async () => {
    const { service, send, record } = makeService({
      run: runningRun,
      tool: todosTool,
    });

    const result = await service.forward(getTodo);

    expect(send).toHaveBeenCalledWith({
      url: 'http://upstream.test/todos/1?expand=true',
      method: 'GET',
      headers: { authorization: 'Bearer secret' },
      body: null,
      timeoutMs: 1000,
    });
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"id":1}');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        sequence: 1,
        path: '/todos/1',
        query: 'expand=true',
        responseStatus: 200,
        upstreamDurationMs: 7,
        errorCode: null,
        faults: [],
      }),
    );
  });

  it('returns 502 when the tool cannot be reached', async () => {
    const send = vi
      .fn()
      .mockRejectedValue(new UpstreamError('UPSTREAM_UNREACHABLE'));
    const { service, record } = makeService({
      run: runningRun,
      tool: todosTool,
      send,
    });

    const result = await service.forward(getTodo);

    expect(result.status).toBe(502);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        responseStatus: 502,
        errorCode: 'UPSTREAM_UNREACHABLE',
        upstreamDurationMs: null,
      }),
    );
  });

  it('returns 504 when the tool does not answer in time', async () => {
    const send = vi
      .fn()
      .mockRejectedValue(new UpstreamError('UPSTREAM_TIMEOUT'));
    const { service } = makeService({ run: runningRun, tool: todosTool, send });

    const result = await service.forward(getTodo);

    expect(result.status).toBe(504);
    expect(JSON.parse(result.body)).toEqual({ error: 'UPSTREAM_TIMEOUT' });
  });

  it('applies a "continue" card, then still forwards', async () => {
    const { card, apply } = fakeCard('slow', { kind: 'continue' });
    const { service, send, record } = makeService({
      run: { ...runningRun, faultRules: [alwaysRule('slow')] },
      tool: todosTool,
      cards: [card],
    });

    const result = await service.forward(getTodo);

    expect(apply).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    expect(result.status).toBe(200);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        faults: [expect.objectContaining({ ruleId: 'always-slow' })],
      }),
    );
  });

  it('answers from a "respond" card without calling the tool', async () => {
    const { card } = fakeCard('broken', {
      kind: 'respond',
      status: 503,
      body: '{"error":"HTTP 503"}',
    });
    const { service, send, record } = makeService({
      run: { ...runningRun, faultRules: [alwaysRule('broken')] },
      tool: todosTool,
      cards: [card],
    });

    const result = await service.forward(getTodo);

    expect(send).not.toHaveBeenCalled();
    expect(result.status).toBe(503);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        responseStatus: 503,
        upstreamDurationMs: null,
        faults: [expect.objectContaining({ type: 'broken' })],
      }),
    );
  });

  it('skips a fault type that has no card', async () => {
    const { service, send, record } = makeService({
      run: { ...runningRun, faultRules: [alwaysRule('slow_dns')] },
      tool: todosTool,
    });

    const result = await service.forward(getTodo);

    expect(send).toHaveBeenCalledOnce();
    expect(result.status).toBe(200);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ faults: [] }),
    );
  });
});
