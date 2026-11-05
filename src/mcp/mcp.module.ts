import { Module } from '@nestjs/common';
import { FaultsModule } from '../faults/faults.module.js';
import { ProxyModule } from '../proxy/proxy.module.js';
import { TracesModule } from '../traces/traces.module.js';
import { McpProxyController } from './mcp-proxy.controller.js';
import { McpProxyService } from './mcp-proxy.service.js';

@Module({
  imports: [FaultsModule, TracesModule, ProxyModule],
  controllers: [McpProxyController],
  providers: [McpProxyService],
})
export class McpModule {}
