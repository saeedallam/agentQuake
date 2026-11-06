import { Module } from '@nestjs/common';
import { FaultRegistry } from '../core/faults/fault-registry.js';

@Module({
  providers: [{ provide: FaultRegistry, useValue: new FaultRegistry() }],
  exports: [FaultRegistry],
})
export class FaultsModule {}
