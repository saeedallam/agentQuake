import { Body, Controller, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { parseInput, slugSchema } from '../common/validation.js';
import { ProjectsService } from './projects.service.js';

const projectBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const toolBody = z.object({
  baseUrl: z.url(),
  timeoutMs: z.int().min(1).max(600_000).optional(),
});

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Put(':project')
  saveProject(@Param('project') project: string, @Body() body: unknown) {
    return this.projects.saveProject(
      parseInput(slugSchema, project),
      parseInput(projectBody, body),
    );
  }

  @Put(':project/tools/:tool')
  saveTool(
    @Param('project') project: string,
    @Param('tool') tool: string,
    @Body() body: unknown,
  ) {
    return this.projects.saveTool(
      parseInput(slugSchema, project),
      parseInput(slugSchema, tool),
      parseInput(toolBody, body),
    );
  }
}
