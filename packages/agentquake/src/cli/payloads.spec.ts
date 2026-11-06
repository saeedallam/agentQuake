import { httpPayload, mcpPayload, type HttpReply } from './payloads.js';

function reply(contentType: string, body: string, status = 200): HttpReply {
  return {
    status,
    headers: { 'content-type': contentType },
    body: Buffer.from(body),
  };
}

const text = (value: HttpReply) => Buffer.from(value.body).toString('utf8');

describe('httpPayload', () => {
  it('decodes and encodes JSON bodies', () => {
    const original = reply('application/json; charset=utf-8', '{"a":[1,2]}');

    expect(httpPayload.decode(original)).toEqual({ a: [1, 2] });
    const encoded = httpPayload.encode(original, { a: [] });
    expect(text(encoded)).toBe('{"a":[]}');
    expect(encoded.status).toBe(200);
    expect(encoded.headers).toEqual(original.headers);
  });

  it('treats text bodies as strings', () => {
    const original = reply('text/plain', 'abcdef');

    expect(httpPayload.decode(original)).toBe('abcdef');
    expect(text(httpPayload.encode(original, 'abc'))).toBe('abc');
  });

  it.each([
    ['binary bodies', reply('image/png', 'xx')],
    ['event streams', reply('text/event-stream', 'data: x')],
    ['invalid JSON', reply('application/json', '{oops')],
    ['error responses', reply('application/json', '{"error":1}', 404)],
  ])('leaves %s alone', (_name, value) => {
    expect(httpPayload.decode(value)).toBeUndefined();
  });
});

describe('mcpPayload', () => {
  const structured = JSON.stringify({
    jsonrpc: '2.0',
    id: 4,
    result: {
      structuredContent: { results: [1, 2] },
      content: [{ type: 'text', text: '{"results":[1,2]}' }],
    },
  });

  it('changes structuredContent and its text copy the same way', () => {
    expect(mcpPayload.decode(structured)).toEqual({ results: [1, 2] });

    const encoded = JSON.parse(
      mcpPayload.encode(structured, { results: [] }) ?? '',
    );
    expect(encoded).toEqual({
      jsonrpc: '2.0',
      id: 4,
      result: {
        structuredContent: { results: [] },
        content: [{ type: 'text', text: '{"results":[]}' }],
      },
    });
  });

  it('changes JSON inside a text item, and plain text as a string', () => {
    const json = JSON.stringify({
      jsonrpc: '2.0',
      id: 5,
      result: { content: [{ type: 'text', text: '[1,2,3,4]' }] },
    });
    const plain = JSON.stringify({
      jsonrpc: '2.0',
      id: 6,
      result: { content: [{ type: 'text', text: 'Sunny in Cairo' }] },
    });

    expect(mcpPayload.decode(json)).toEqual([1, 2, 3, 4]);
    expect(
      JSON.parse(mcpPayload.encode(json, [1, 2]) ?? '').result.content[0].text,
    ).toBe('[1,2]');
    expect(mcpPayload.decode(plain)).toBe('Sunny in Cairo');
    expect(
      JSON.parse(mcpPayload.encode(plain, 'Sunny') ?? '').result.content[0]
        .text,
    ).toBe('Sunny');
  });

  it('leaves errors and empty replies alone', () => {
    expect(
      mcpPayload.decode('{"jsonrpc":"2.0","id":1,"error":{"code":-1}}'),
    ).toBeUndefined();
    expect(mcpPayload.decode(null)).toBeUndefined();
  });
});
