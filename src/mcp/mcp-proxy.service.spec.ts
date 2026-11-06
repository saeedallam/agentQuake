import type { FaultRule } from '../core/faults/fault-planner.js';
import { FaultRegistry } from '../core/faults/fault-registry.js';
import type {
  RunInfo,
  TargetProvider,
  ToolInfo,
} from '../proxy/target.provider.js';
import {
  UpstreamError,
  type UpstreamClient,
} from '../proxy/upstream.client.js';
import type { TraceRecorder } from '../traces/trace.recorder.js';
import { McpProxyService, type McpProxyRequest } from './mcp-proxy.service.js';

const RUN_ID = '00000000-0000-7000-8000-000000000001';

const runningRun: RunInfo = {
  id: RUN_ID,
  status: 'RUNNING',
  projectId: 'project-1',
  seed: 42,
  faultRules: [],
};

const weatherTool: ToolInfo = {
  id: 'tool-1',
  baseUrl: 'http://weather.test/mcp',
  timeoutMs: 1000,
};

const serverReply = {
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: '{"jsonrpc":"2.0","id":7,"result":{"content":[]}}',
  durationMs: 5,
};

function mcpRequest(message: unknown): McpProxyRequest {
  return {
    runId: RUN_ID,
    toolSlug: 'weather',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(JSON.stringify(message)),
  };
}

const getForecast = mcpRequest({
  jsonrpc: '2.0',
  id: 7,
  method: 'tools/call',
  params: { name: 'get_forecast', arguments: { city: 'Cairo' } },
});

const listTools = mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

function failingRule(path?: string): FaultRule {
  return {
    id: 'forecast-down',
    type: 'http_error',
    target: { tool: 'weather', path },
    probability: 1,
    config: { status: 503 },
  };
}

function makeService(options: {
  run?: RunInfo | null;
  tool?: ToolInfo | null;
  send?: UpstreamClient['send'];
}) {
  const targets = {
    findRun: vi
      .fn()
      .mockResolvedValue(options.run === undefined ? runningRun : options.run),
    findTool: vi
      .fn()
      .mockResolvedValue(
        options.tool === undefined ? weatherTool : options.tool,
      ),
  } as unknown as TargetProvider;
  const send = options.send ?? vi.fn().mockResolvedValue(serverReply);
  const upstream = { send } as unknown as UpstreamClient;
  const nextSequence = vi.fn().mockResolvedValue(1);
  const record = vi.fn().mockResolvedValue(undefined);
  const recorder = { nextSequence, record } as unknown as TraceRecorder;

  return {
    service: new McpProxyService(
      targets,
      upstream,
      recorder,
      new FaultRegistry(),
    ),
    send,
    nextSequence,
    record,
  };
}

describe('McpProxyService', () => {
  it('returns 404 when the run does not exist', async () => {
    const { service } = makeService({ run: null });

    const result = await service.forward(getForecast);

    expect(result.status).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ error: 'RUN_NOT_FOUND' });
  });

  it('returns 409 when the run is not running', async () => {
    const { service } = makeService({
      run: { ...runningRun, status: 'COMPLETED' },
    });

    const result = await service.forward(getForecast);

    expect(result.status).toBe(409);
  });

  it('returns 404 when the tool does not exist', async () => {
    const { service } = makeService({ tool: null });

    const result = await service.forward(getForecast);

    expect(result.status).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ error: 'TOOL_NOT_FOUND' });
  });

  it('forwards other messages untouched and records no trace', async () => {
    const { service, send, nextSequence, record } = makeService({
      run: { ...runningRun, faultRules: [failingRule()] },
    });

    const result = await service.forward(listTools);

    expect(send).toHaveBeenCalledWith({
      url: 'http://weather.test/mcp',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: listTools.body,
      timeoutMs: 1000,
    });
    expect(result.body).toBe(serverReply.body);
    expect(nextSequence).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('forwards a tool call without faults and records it by tool name', async () => {
    const { service, send, record } = makeService({});

    const result = await service.forward(getForecast);

    expect(send).toHaveBeenCalledOnce();
    expect(result.status).toBe(200);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        sequence: 1,
        method: 'tools/call',
        path: 'get_forecast',
        responseStatus: 200,
        upstreamDurationMs: 5,
        errorCode: null,
        faults: [],
      }),
    );
  });

  it('answers a failed tool result with the same id when a fault responds', async () => {
    const { service, send, record } = makeService({
      run: { ...runningRun, faultRules: [failingRule('get_*')] },
    });

    const result = await service.forward(getForecast);

    expect(send).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({
      jsonrpc: '2.0',
      id: 7,
      result: { isError: true },
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'get_forecast',
        upstreamDurationMs: null,
        faults: [expect.objectContaining({ ruleId: 'forecast-down' })],
      }),
    );
  });

  it('matches fault targets against the tool name', async () => {
    const { service, send } = makeService({
      run: { ...runningRun, faultRules: [failingRule('send_*')] },
    });

    await service.forward(getForecast);

    expect(send).toHaveBeenCalledOnce();
  });

  it('returns 502 and records the error when the server is unreachable', async () => {
    const { service, record } = makeService({
      send: vi
        .fn()
        .mockRejectedValue(new UpstreamError('UPSTREAM_UNREACHABLE')),
    });

    const result = await service.forward(getForecast);

    expect(result.status).toBe(502);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'UPSTREAM_UNREACHABLE' }),
    );
  });

  it('returns 504 when the server times out', async () => {
    const { service } = makeService({
      send: vi.fn().mockRejectedValue(new UpstreamError('UPSTREAM_TIMEOUT')),
    });

    const result = await service.forward(getForecast);

    expect(result.status).toBe(504);
  });
});
