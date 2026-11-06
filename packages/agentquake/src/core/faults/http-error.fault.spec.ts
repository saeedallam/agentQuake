import { HttpErrorFault } from './http-error.fault.js';

describe('HttpErrorFault', () => {
  it('answers with the configured status instead of the tool', async () => {
    const outcome = await new HttpErrorFault().apply({ status: 429 });

    expect(outcome).toEqual({
      kind: 'respond',
      status: 429,
      body: '{"error":"HTTP 429"}',
    });
  });

  it('uses 503 when no status is given', async () => {
    const outcome = await new HttpErrorFault().apply({});

    expect(outcome).toMatchObject({ kind: 'respond', status: 503 });
  });
});
