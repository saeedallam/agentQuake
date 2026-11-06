import { Module } from '@nestjs/common';
import { FaultRegistry } from 'agentquake/core';

@Module({
  providers: [{ provide: FaultRegistry, useValue: new FaultRegistry() }],
  exports: [FaultRegistry],
})
export class FaultsModule {}
