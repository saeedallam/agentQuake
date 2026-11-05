import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { McpModule } from './mcp/mcp.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { ProxyModule } from './proxy/proxy.module.js';
import { RunsModule } from './runs/runs.module.js';
import { ScenariosModule } from './scenarios/scenarios.module.js';

@Module({
  imports: [
    PrismaModule,
    ProjectsModule,
    ScenariosModule,
    RunsModule,
    ProxyModule,
    McpModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
