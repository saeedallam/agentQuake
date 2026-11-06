import { describe, expect, it } from 'vitest';
import {
  parseJsonBody,
  readMessageId,
  readToolCall,
  toolErrorResponse,
} from './mcp-message.js';

function toolCall(overrides: Record<string, unknown> = {}) {
  return {
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name: 'get_weather', arguments: { city: 'Cairo' } },
    ...overrides,
  };
}

describe('parseJsonBody', () => {
  it('parses a JSON body', () => {
    expect(parseJsonBody(Buffer.from('{"id":7}'))).toEqual({ id: 7 });
  });

  it('returns null when there is no body', () => {
    expect(parseJsonBody(null)).toBeNull();
  });

  it.each(['', '{abc', 'not json'])(
    'returns null for a body that is not JSON: %j',
    (text) => {
      expect(parseJsonBody(Buffer.from(text))).toBeNull();
    },
  );
});

describe('readToolCall', () => {
  it('reads the id, tool name and arguments of a tools/call request', () => {
    expect(readToolCall(toolCall())).toEqual({
      id: 7,
      name: 'get_weather',
      arguments: { city: 'Cairo' },
    });
  });

  it('accepts a string id', () => {
    expect(readToolCall(toolCall({ id: 'abc' }))?.id).toBe('abc');
  });

  it.each([null, 'text', 42, [toolCall()]])(
    'ignores a message that is not an object: %j',
    (message) => {
      expect(readToolCall(message)).toBeNull();
    },
  );

  it('ignores other methods', () => {
    expect(readToolCall(toolCall({ method: 'tools/list' }))).toBeNull();
  });

  it('ignores a message without a method', () => {
    expect(readToolCall(toolCall({ method: undefined }))).toBeNull();
  });

  it.each([undefined, null, { n: 1 }])(
    'ignores a notification or an invalid id: %j',
    (id) => {
      expect(readToolCall(toolCall({ id }))).toBeNull();
    },
  );

  it.each([undefined, null, 5, ['get_weather']])(
    'ignores invalid params: %j',
    (params) => {
      expect(readToolCall(toolCall({ params }))).toBeNull();
    },
  );

  it('ignores a call without a tool name', () => {
    expect(
      readToolCall(toolCall({ params: { arguments: { city: 'Cairo' } } })),
    ).toBeNull();
  });

  it.each([undefined, null, 'Cairo', ['Cairo']])(
    'uses empty arguments when they are missing or invalid: %j',
    (args) => {
      const call = readToolCall(
        toolCall({ params: { name: 'list_todos', arguments: args } }),
      );
      expect(call?.arguments).toEqual({});
    },
  );
});

describe('readMessageId', () => {
  it.each([
    ['{"jsonrpc":"2.0","id":7,"method":"tools/list"}', 7],
    ['{"jsonrpc":"2.0","id":"abc","result":{}}', 'abc'],
  ])('reads the id of %s', (line, id) => {
    expect(readMessageId(line)).toBe(id);
  });

  it.each([
    '{"jsonrpc":"2.0","method":"notifications/initialized"}',
    '{"jsonrpc":"2.0","id":null,"error":{}}',
    '{abc',
    '42',
    '',
  ])('returns null when there is no usable id: %j', (line) => {
    expect(readMessageId(line)).toBeNull();
  });
});

describe('toolErrorResponse', () => {
  const call = { id: 7, name: 'get_weather', arguments: {} };

  it('answers with a failed tool result the AI can read', () => {
    expect(toolErrorResponse(call, 503, '{"error":"HTTP 503"}')).toEqual({
      jsonrpc: '2.0',
      id: 7,
      result: {
        content: [
          {
            type: 'text',
            text: 'Tool get_weather failed with HTTP 503: {"error":"HTTP 503"}',
          },
        ],
        isError: true,
      },
    });
  });

  it('keeps the id of the request, including string ids', () => {
    expect(toolErrorResponse({ ...call, id: 'abc' }, 429, '').id).toBe('abc');
  });
});
