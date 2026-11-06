import { Injectable } from '@nestjs/common';
import { FaultRegistry, planFaults, runFaults } from 'agentquake/core';
import { TraceRecorder } from '../traces/trace.recorder.js';
import { TargetProvider } from './target.provider.js';
import { UpstreamClient, UpstreamError } from './upstream.client.js';

export interface ProxyRequest {
  runId: string;
  toolSlug: string;
  method: string;
  path: string;
  query: string | null;
  headers: Record<string, string>;
  body: Buffer | null;
}

export interface ProxyResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}

const JSON_HEADERS = { 'content-type': 'application/json' };

@Injectable()
export class ProxyService {
  constructor(
    private readonly targets: TargetProvider,
    private readonly upstream: UpstreamClient,
    private readonly recorder: TraceRecorder,
    private readonly faults: FaultRegistry,
  ) {}

  async forward(request: ProxyRequest): Promise<ProxyResult> {
    const startedAt = Date.now();

    const run = await this.targets.findRun(request.runId);
    if (!run) {
      return errorResult(404, 'RUN_NOT_FOUND', startedAt);
    }
    if (run.status !== 'RUNNING') {
      return errorResult(409, 'RUN_NOT_RUNNING', startedAt);
    }

    const tool = await this.targets.findTool(run.projectId, request.toolSlug);
    if (!tool) {
      return errorResult(404, 'TOOL_NOT_FOUND', startedAt);
    }

    const sequence = await this.recorder.nextSequence(run.id);
    const planned = planFaults(run.faultRules, {
      toolSlug: request.toolSlug,
      path: request.path,
      seed: run.seed,
      sequence,
    });

    const faultRun = await runFaults(planned, this.faults);

    let result: ProxyResult | undefined;
    if (faultRun.outcome.kind === 'respond') {
      result = {
        status: faultRun.outcome.status,
        headers: JSON_HEADERS,
        body: faultRun.outcome.body,
        durationMs: Date.now() - startedAt,
      };
    }

    let upstreamDurationMs: number | null = null;
    let errorCode: string | null = null;
    if (!result) {
      const url =
        tool.baseUrl +
        request.path +
        (request.query ? `?${request.query}` : '');
      try {
        const response = await this.upstream.send({
          url,
          method: request.method,
          headers: request.headers,
          body: request.body,
          timeoutMs: tool.timeoutMs,
        });
        upstreamDurationMs = response.durationMs;
        result = {
          status: response.status,
          headers: response.headers,
          body: response.body,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        if (!(error instanceof UpstreamError)) {
          throw error;
        }
        errorCode = error.code;
        const status = error.code === 'UPSTREAM_TIMEOUT' ? 504 : 502;
        result = errorResult(status, error.code, startedAt);
      }
    }

    await this.recorder.record({
      runId: run.id,
      toolId: tool.id,
      sequence,
      method: request.method,
      path: request.path,
      query: request.query,
      requestHeaders: request.headers,
      requestBody: request.body ? request.body.toString('utf8') : null,
      responseStatus: result.status,
      responseHeaders: result.headers,
      responseBody: result.body,
      startedAt,
      durationMs: result.durationMs,
      upstreamDurationMs,
      errorCode,
      faults: faultRun.applied,
    });

    return result;
  }
}

export function errorResult(
  status: number,
  error: string,
  startedAt: number,
): ProxyResult {
  return {
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error }),
    durationMs: Date.now() - startedAt,
  };
}
