import { Module } from '@nestjs/common';
import { TraceRecorder } from './trace.recorder.js';

@Module({
  providers: [TraceRecorder],
  exports: [TraceRecorder],
})
export class TracesModule {}
