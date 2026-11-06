import type { FaultPlugin } from './fault.js';
import { HttpErrorFault } from './http-error.fault.js';
import { LatencyFault } from './latency.fault.js';
import { TimeoutFault } from './timeout.fault.js';

export class FaultRegistry {
  private readonly plugins = new Map<string, FaultPlugin>();

  constructor() {
    this.register(new LatencyFault());
    this.register(new HttpErrorFault());
    this.register(new TimeoutFault());
  }

  register(plugin: FaultPlugin) {
    this.plugins.set(plugin.type, plugin);
  }

  get(type: string): FaultPlugin | undefined {
    return this.plugins.get(type);
  }

  types(): string[] {
    return [...this.plugins.keys()];
  }
}
