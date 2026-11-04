import { describe, expect, it } from 'vitest';
import { readToolCall } from './mcp-message.js';

function toolCall(overrides: Record<string, unknown> = {}) {
  return {
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name: 'get_weather', arguments: { city: 'Cairo' } },
    ...overrides,
  };
}

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
