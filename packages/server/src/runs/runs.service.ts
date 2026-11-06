import { randomInt } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { scenarioSchema } from 'agentquake/core';

const MAX_SEED = 2_147_483_647;

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  async startRun(projectSlug: string, scenarioName: string, seed?: number) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });
    if (!project) {
      throw new NotFoundException({ error: 'PROJECT_NOT_FOUND' });
    }

    const stored = await this.prisma.scenario.findUnique({
      where: {
        projectId_name: { projectId: project.id, name: scenarioName },
      },
    });
    if (!stored) {
      throw new NotFoundException({ error: 'SCENARIO_NOT_FOUND' });
    }

    const scenario = scenarioSchema.parse(stored.definition);
    const runSeed = seed ?? scenario.seed ?? randomInt(MAX_SEED);

    const run = await this.prisma.run.create({
      data: {
        scenarioId: stored.id,
        status: 'RUNNING',
        seed: runSeed,
        scenarioSnapshot: scenario as Prisma.InputJsonValue,
        startedAt: new Date(),
      },
    });

    return {
      id: run.id,
      status: run.status,
      seed: run.seed,
      scenario: stored.name,
      proxyBaseUrl: `/proxy/${run.id}`,
    };
  }

  async completeRun(runId: string) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ error: 'RUN_NOT_FOUND' });
    }
    if (run.status !== 'RUNNING') {
      throw new ConflictException({ error: 'RUN_NOT_RUNNING' });
    }

    const finished = await this.prisma.run.update({
      where: { id: runId },
      data: { status: 'COMPLETED', finishedAt: new Date() },
    });

    return {
      id: finished.id,
      status: finished.status,
      finishedAt: finished.finishedAt,
    };
  }

  async listTraces(runId: string) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ error: 'RUN_NOT_FOUND' });
    }

    const traces = await this.prisma.trace.findMany({
      where: { runId },
      orderBy: { sequence: 'asc' },
      include: { tool: { select: { slug: true } }, faults: true },
    });

    return traces.map((trace) => ({
      sequence: trace.sequence,
      tool: trace.tool.slug,
      method: trace.method,
      path: trace.path,
      query: trace.query,
      requestHeaders: trace.requestHeaders,
      responseStatus: trace.responseStatus,
      durationMs: trace.durationMs,
      upstreamDurationMs: trace.upstreamDurationMs,
      errorCode: trace.errorCode,
      bodyTruncated: trace.bodyTruncated,
      faults: trace.faults.map((fault) => ({
        ruleId: fault.ruleId,
        type: fault.faultType,
        config: fault.config,
      })),
    }));
  }
}
