import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { FaultRule } from '../core/faults/fault-planner.js';
import { scenarioSchema } from '../core/scenarios/scenario.js';

export interface RunInfo {
  id: string;
  status: string;
  projectId: string;
  seed: number;
  faultRules: FaultRule[];
}

export interface ToolInfo {
  id: string;
  baseUrl: string;
  timeoutMs: number;
}

@Injectable()
export class TargetProvider {
  constructor(private readonly prisma: PrismaService) {}

  async findRun(runId: string): Promise<RunInfo | null> {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: { scenario: { select: { projectId: true } } },
    });
    if (!run) {
      return null;
    }

    const snapshot = scenarioSchema.safeParse(run.scenarioSnapshot);

    return {
      id: run.id,
      status: run.status,
      projectId: run.scenario.projectId,
      seed: run.seed,
      faultRules: snapshot.success ? snapshot.data.faults : [],
    };
  }

  async findTool(projectId: string, slug: string): Promise<ToolInfo | null> {
    const tool = await this.prisma.tool.findUnique({
      where: { projectId_slug: { projectId, slug } },
    });
    if (!tool) {
      return null;
    }

    return { id: tool.id, baseUrl: tool.baseUrl, timeoutMs: tool.timeoutMs };
  }
}
