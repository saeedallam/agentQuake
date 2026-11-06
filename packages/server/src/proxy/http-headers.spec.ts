import {
  requestHeadersToForward,
  responseHeadersToReturn,
} from './http-headers.js';

describe('requestHeadersToForward', () => {
  it('keeps normal headers and drops ones that belong to this hop', () => {
    const forwarded = requestHeadersToForward({
      host: 'localhost:3000',
      connection: 'keep-alive',
      'content-length': '12',
      authorization: 'Bearer secret',
      'content-type': 'application/json',
      accept: ['application/json', 'text/plain'],
    });

    expect(forwarded).toEqual({
      authorization: 'Bearer secret',
      'content-type': 'application/json',
      accept: 'application/json, text/plain',
    });
  });
});

describe('responseHeadersToReturn', () => {
  it('drops headers that no longer match the decoded body', () => {
    const upstream = new Headers({
      'content-type': 'application/json',
      'content-encoding': 'gzip',
      'content-length': '42',
      'retry-after': '2',
    });

    expect(responseHeadersToReturn(upstream)).toEqual({
      'content-type': 'application/json',
      'retry-after': '2',
    });
  });
});
