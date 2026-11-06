import {
  MAX_BODY_LENGTH,
  REDACTED,
  redactHeaders,
  redactQuery,
  truncateBody,
} from './trace-policy.js';

describe('redactHeaders', () => {
  it('hides secrets and keeps everything else', () => {
    const headers = {
      authorization: 'Bearer sk-live-123',
      cookie: 'session=abc',
      'x-api-key': 'key-456',
      'content-type': 'application/json',
    };

    expect(redactHeaders(headers)).toEqual({
      authorization: REDACTED,
      cookie: REDACTED,
      'x-api-key': REDACTED,
      'content-type': 'application/json',
    });
  });
});

describe('redactQuery', () => {
  it('hides secret parameters and keeps the rest', () => {
    expect(redactQuery('city=Cairo&api_key=sk_123&token=t')).toBe(
      `city=Cairo&api_key=${REDACTED}&token=${REDACTED}`,
    );
  });

  it('keeps an empty query empty', () => {
    expect(redactQuery(null)).toBeNull();
  });
});

describe('truncateBody', () => {
  it('keeps a small body as it is', () => {
    expect(truncateBody('{"id":1}')).toEqual({
      body: '{"id":1}',
      truncated: false,
    });
  });

  it('cuts a large body and says so', () => {
    const result = truncateBody('x'.repeat(MAX_BODY_LENGTH + 10));

    expect(result.body).toHaveLength(MAX_BODY_LENGTH);
    expect(result.truncated).toBe(true);
  });
});
