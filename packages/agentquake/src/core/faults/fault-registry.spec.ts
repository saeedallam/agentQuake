import { FaultRegistry } from './fault-registry.js';
import { HttpErrorFault } from './http-error.fault.js';
import { LatencyFault } from './latency.fault.js';
import { TimeoutFault } from './timeout.fault.js';

describe('FaultRegistry', () => {
  it('finds every built-in card by its type', () => {
    const registry = new FaultRegistry();

    expect(registry.get('latency')).toBeInstanceOf(LatencyFault);
    expect(registry.get('http_error')).toBeInstanceOf(HttpErrorFault);
    expect(registry.get('timeout')).toBeInstanceOf(TimeoutFault);
  });

  it('returns undefined for an unknown type', () => {
    const registry = new FaultRegistry();

    expect(registry.get('slow_dns')).toBeUndefined();
  });

  it('lists the known types', () => {
    const registry = new FaultRegistry();

    expect(registry.types()).toEqual(['latency', 'http_error', 'timeout']);
  });
});
