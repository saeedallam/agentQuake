import { Injectable } from '@nestjs/common';
import { FaultRegistry } from '../core/faults/fault-registry.js';
import { planFaults } from '../core/faults/fault-planner.js';
import { runFaults } from '../core/faults/fault-runner.js';
import { errorResult, type ProxyResult } from '../proxy/proxy.service.js';
import { TargetProvider, type ToolInfo } from '../proxy/target.provider.js';
import { UpstreamClient, UpstreamError } from '../proxy/upstream.client.js';
import { TraceRecorder } from '../traces/trace.recorder.js';
import {
  parseJsonBody,
  readToolCall,
  toolErrorResponse,
} from '../core/mcp/mcp-message.js';

export interface McpProxyRequest {
  runId: string;
  toolSlug: string;
  method: string;
  headers: Record<string, string>;
  body: Buffer | null;
}

interface ServerReply {
  result: ProxyResult;
  upstreamDurationMs: number | null;
  errorCode: string | null;
}

@Injectable()
export class McpProxyService {
  constructor(
    private readonly targets: TargetProvider,
    private readonly upstream: UpstreamClient,
    private readonly recorder: TraceRecorder,
    private readonly faults: FaultRegistry,
  ) {}

  async forward(request: McpProxyRequest): Promise<ProxyResult> {
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

    const call = readToolCall(parseJsonBody(request.body));
    if (!call) {
      const reply = await this.sendToServer(tool, request, startedAt);
      return reply.result;
    }

    const sequence = await this.recorder.nextSequence(run.id);
    const planned = planFaults(run.faultRules, {
      toolSlug: request.toolSlug,
      path: call.name,
      seed: run.seed,
      sequence,
    });
    const faultRun = await runFaults(planned, this.faults);

    let reply: ServerReply;
    if (faultRun.outcome.kind === 'respond') {
      reply = {
        result: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            toolErrorResponse(
              call,
              faultRun.outcome.status,
              faultRun.outcome.body,
            ),
          ),
          durationMs: Date.now() - startedAt,
        },
        upstreamDurationMs: null,
        errorCode: null,
      };
    } else {
      reply = await this.sendToServer(tool, request, startedAt);
    }

    await this.recorder.record({
      runId: run.id,
      toolId: tool.id,
      sequence,
      method: 'tools/call',
      path: call.name,
      query: null,
      requestHeaders: request.headers,
      requestBody: request.body ? request.body.toString('utf8') : null,
      responseStatus: reply.result.status,
      responseHeaders: reply.result.headers,
      responseBody: reply.result.body,
      startedAt,
      durationMs: reply.result.durationMs,
      upstreamDurationMs: reply.upstreamDurationMs,
      errorCode: reply.errorCode,
      faults: faultRun.applied,
    });

    return reply.result;
  }

  private async sendToServer(
    tool: ToolInfo,
    request: McpProxyRequest,
    startedAt: number,
  ): Promise<ServerReply> {
    try {
      const response = await this.upstream.send({
        url: tool.baseUrl,
        method: request.method,
        headers: request.headers,
        body: request.body,
        timeoutMs: tool.timeoutMs,
      });

      return {
        result: {
          status: response.status,
          headers: response.headers,
          body: response.body,
          durationMs: Date.now() - startedAt,
        },
        upstreamDurationMs: response.durationMs,
        errorCode: null,
      };
    } catch (error) {
      if (!(error instanceof UpstreamError)) {
        throw error;
      }

      const status = error.code === 'UPSTREAM_TIMEOUT' ? 504 : 502;
      return {
        result: {
          status,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: error.code }),
          durationMs: Date.now() - startedAt,
        },
        upstreamDurationMs: null,
        errorCode: error.code,
      };
    }
  }
}
