import { Module } from '@nestjs/common';
import { FaultsModule } from '../faults/faults.module.js';
import { ScenariosController } from './scenarios.controller.js';
import { ScenariosService } from './scenarios.service.js';

@Module({
  imports: [FaultsModule],
  controllers: [ScenariosController],
  providers: [ScenariosService],
})
export class ScenariosModule {}
