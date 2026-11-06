import { ToolFailure } from './tool-failure.js';

describe('ToolFailure', () => {
  it('reads like a real tool failure and keeps the details', () => {
    const failure = new ToolFailure('getWeather', 503);

    expect(failure).toBeInstanceOf(Error);
    expect(failure.name).toBe('ToolFailure');
    expect(failure.message).toBe('Tool getWeather failed with HTTP 503');
    expect(failure.tool).toBe('getWeather');
    expect(failure.status).toBe(503);
  });
});
