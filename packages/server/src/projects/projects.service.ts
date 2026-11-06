import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

export interface ProjectInput {
  name: string;
  description?: string;
}

export interface ToolInput {
  baseUrl: string;
  timeoutMs?: number;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveProject(slug: string, input: ProjectInput) {
    const project = await this.prisma.project.upsert({
      where: { slug },
      update: { name: input.name, description: input.description ?? null },
      create: { slug, name: input.name, description: input.description },
    });

    return {
      slug: project.slug,
      name: project.name,
      description: project.description,
    };
  }

  async saveTool(projectSlug: string, toolSlug: string, input: ToolInput) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
    });
    if (!project) {
      throw new NotFoundException({ error: 'PROJECT_NOT_FOUND' });
    }

    const tool = await this.prisma.tool.upsert({
      where: { projectId_slug: { projectId: project.id, slug: toolSlug } },
      update: { baseUrl: input.baseUrl, timeoutMs: input.timeoutMs },
      create: {
        projectId: project.id,
        slug: toolSlug,
        baseUrl: input.baseUrl,
        timeoutMs: input.timeoutMs,
      },
    });

    return {
      slug: tool.slug,
      baseUrl: tool.baseUrl,
      timeoutMs: tool.timeoutMs,
    };
  }
}
