import { EmptyResponseFault } from './empty-response.fault.js';
import { TruncatedResponseFault } from './truncated-response.fault.js';

const forecast = { total: 3, results: [{ day: 1 }, { day: 2 }, { day: 3 }] };

describe('EmptyResponseFault', () => {
  const fault = new EmptyResponseFault();

  it('lets the call go ahead', async () => {
    await expect(fault.apply()).resolves.toEqual({ kind: 'continue' });
  });

  it('blanks the value by default', () => {
    expect(fault.corrupt(forecast, {})).toEqual({});
    expect(fault.corrupt('Sunny', {})).toBe('');
  });

  it('keeps the shape and empties the lists in no-results mode', () => {
    expect(fault.corrupt(forecast, { mode: 'no-results' })).toEqual({
      total: 3,
      results: [],
    });
  });

  it('rejects an unknown mode', () => {
    expect(fault.validateConfig({ mode: 'all' })).toEqual([
      expect.stringContaining('mode'),
    ]);
    expect(fault.validateConfig({ mode: 'no-results' })).toEqual([]);
  });
});

describe('TruncatedResponseFault', () => {
  const fault = new TruncatedResponseFault();

  it('lets the call go ahead', async () => {
    await expect(fault.apply()).resolves.toEqual({ kind: 'continue' });
  });

  it('keeps half by default', () => {
    expect(fault.corrupt(forecast, {})).toEqual({
      total: 3,
      results: [{ day: 1 }],
    });
  });

  it('keeps the configured fraction', () => {
    expect(fault.corrupt('abcdefghij', { keep: 0.3 })).toBe('abc');
  });

  it('rejects keep outside 0..1', () => {
    expect(fault.validateConfig({ keep: 2 })).toEqual([
      expect.stringContaining('keep'),
    ]);
    expect(fault.validateConfig({ keep: 0.2 })).toEqual([]);
  });
});
