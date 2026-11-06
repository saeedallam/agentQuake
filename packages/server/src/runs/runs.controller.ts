import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { parseInput, slugSchema } from '../common/validation.js';
import { RunsService } from './runs.service.js';

const startRunBody = z
  .object({ seed: z.int().min(0).max(2_147_483_647).optional() })
  .default({});

@Controller()
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post('projects/:project/scenarios/:scenario/runs')
  startRun(
    @Param('project') project: string,
    @Param('scenario') scenario: string,
    @Body() body: unknown,
  ) {
    const { seed } = parseInput(startRunBody, body ?? undefined);
    return this.runs.startRun(
      parseInput(slugSchema, project),
      parseInput(slugSchema, scenario),
      seed,
    );
  }

  @Post('runs/:runId/complete')
  completeRun(@Param('runId', ParseUUIDPipe) runId: string) {
    return this.runs.completeRun(runId);
  }

  @Get('runs/:runId/traces')
  listTraces(@Param('runId', ParseUUIDPipe) runId: string) {
    return this.runs.listTraces(runId);
  }
}
