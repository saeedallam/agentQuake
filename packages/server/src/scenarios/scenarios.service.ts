import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { invalidInput } from '../common/validation.js';
import { FaultRegistry, parseScenario } from 'agentquake/core';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class ScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly faults: FaultRegistry,
  ) {}

  async saveScenario(projectSlug: string, sourceYaml: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      include: { tools: { select: { slug: true } } },
    });
    if (!project) {
      throw new NotFoundException({ error: 'PROJECT_NOT_FOUND' });
    }

    const parsed = parseScenario(
      sourceYaml,
      this.faults.types(),
      this.faults.afterCallTypes(),
    );
    if (!parsed.ok) {
      throw invalidInput(parsed.issues);
    }
    const scenario = parsed.scenario;

    const toolSlugs = project.tools.map((tool) => tool.slug);
    const missingTools = scenario.faults
      .map((fault, index) => ({ tool: fault.target.tool, index }))
      .filter(({ tool }) => !toolSlugs.includes(tool))
      .map(({ tool, index }) => ({
        path: `faults.${index}.target.tool`,
        message: `Project "${projectSlug}" has no tool "${tool}"`,
      }));
    if (missingTools.length > 0) {
      throw invalidInput(missingTools);
    }

    const checksum = createHash('sha256').update(sourceYaml).digest('hex');
    const definition = scenario as Prisma.InputJsonValue;
    const saved = await this.prisma.scenario.upsert({
      where: {
        projectId_name: { projectId: project.id, name: scenario.name },
      },
      update: { sourceYaml, definition, checksum },
      create: {
        projectId: project.id,
        name: scenario.name,
        sourceYaml,
        definition,
        checksum,
      },
    });

    return {
      name: saved.name,
      checksum: saved.checksum,
      faults: scenario.faults.length,
    };
  }
}
