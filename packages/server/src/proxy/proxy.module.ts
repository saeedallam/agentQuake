import { Module } from '@nestjs/common';
import { FaultsModule } from '../faults/faults.module.js';
import { TracesModule } from '../traces/traces.module.js';
import { ProxyController } from './proxy.controller.js';
import { ProxyService } from './proxy.service.js';
import { TargetProvider } from './target.provider.js';
import { UpstreamClient } from './upstream.client.js';

@Module({
  imports: [FaultsModule, TracesModule],
  controllers: [ProxyController],
  providers: [ProxyService, TargetProvider, UpstreamClient],
  exports: [TargetProvider, UpstreamClient],
})
export class ProxyModule {}
