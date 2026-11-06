import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { PlannedFault } from '../core/faults/fault-planner.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  redactHeaders,
  redactQuery,
  truncateBody,
} from '../core/traces/trace-policy.js';

export interface TraceInput {
  runId: string;
  toolId: string;
  sequence: number;
  method: string;
  path: string;
  query: string | null;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseStatus: number | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  startedAt: number;
  durationMs: number;
  upstreamDurationMs: number | null;
  errorCode: string | null;
  faults: PlannedFault[];
}

@Injectable()
export class TraceRecorder {
  constructor(private readonly prisma: PrismaService) {}

  async nextSequence(runId: string): Promise<number> {
    return (await this.prisma.trace.count({ where: { runId } })) + 1;
  }

  async record(input: TraceInput): Promise<void> {
    const requestBody = truncateBody(input.requestBody);
    const responseBody = truncateBody(input.responseBody);

    await this.prisma.trace.create({
      data: {
        runId: input.runId,
        toolId: input.toolId,
        sequence: input.sequence,
        method: input.method,
        path: input.path,
        query: redactQuery(input.query),
        requestHeaders: redactHeaders(input.requestHeaders),
        requestBody: requestBody.body,
        responseStatus: input.responseStatus,
        responseHeaders: input.responseHeaders
          ? redactHeaders(input.responseHeaders)
          : undefined,
        responseBody: responseBody.body,
        bodyTruncated: requestBody.truncated || responseBody.truncated,
        startedAt: new Date(input.startedAt),
        durationMs: input.durationMs,
        upstreamDurationMs: input.upstreamDurationMs,
        errorCode: input.errorCode,
        faults: {
          create: input.faults.map((fault) => ({
            ruleId: fault.ruleId,
            faultType: fault.type,
            config: fault.config as Prisma.InputJsonValue,
          })),
        },
      },
    });
  }
}
