import {
  blank,
  emptyLists,
  isJsonValue,
  truncate,
  type JsonValue,
} from './json-value.js';

describe('isJsonValue', () => {
  it.each<[string, unknown]>([
    ['a string', 'Cairo'],
    ['a number', 30],
    ['a boolean', true],
    ['null', null],
    ['an array', [1, 'two', [3]]],
    ['a plain object', { city: 'Cairo', days: [{ temp: 30 }] }],
  ])('accepts %s', (_name, value) => {
    expect(isJsonValue(value)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a Date', new Date()],
    ['a Map', new Map()],
    ['a function', () => 1],
    ['an object holding a Date', { at: new Date() }],
    ['an array holding undefined', [1, undefined]],
  ])('rejects %s', (_name, value) => {
    expect(isJsonValue(value)).toBe(false);
  });
});

describe('blank', () => {
  it.each<[JsonValue, JsonValue]>([
    ['Sunny', ''],
    [[1, 2, 3], []],
    [{ city: 'Cairo', temp: 30 }, {}],
    [30, 30],
    [true, true],
    [null, null],
  ])('turns %j into %j', (value, expected) => {
    expect(blank(value)).toEqual(expected);
  });
});

describe('emptyLists', () => {
  it('empties every list at any depth and keeps everything else', () => {
    const value: JsonValue = {
      total: 3,
      results: [{ id: 1 }, { id: 2 }, { id: 3 }],
      page: { next: 'p2', tags: ['a', 'b'] },
    };

    expect(emptyLists(value)).toEqual({
      total: 3,
      results: [],
      page: { next: 'p2', tags: [] },
    });
  });

  it('turns a top-level list into an empty list', () => {
    expect(emptyLists([1, 2])).toEqual([]);
  });

  it('leaves values without lists alone', () => {
    expect(emptyLists({ city: 'Cairo' })).toEqual({ city: 'Cairo' });
    expect(emptyLists('Sunny')).toBe('Sunny');
  });
});

describe('truncate', () => {
  it('keeps the first part of a string', () => {
    expect(truncate('abcdefgh', 0.5)).toBe('abcd');
  });

  it('keeps the first items of a list, rounding down', () => {
    expect(truncate([1, 2, 3, 4], 0.5)).toEqual([1, 2]);
    expect(truncate([1, 2, 3], 0.5)).toEqual([1]);
    expect(truncate(['only'], 0.5)).toEqual([]);
  });

  it('keeps every key of an object and truncates inside it', () => {
    expect(
      truncate({ city: 'Cairo', days: [1, 2, 3, 4], note: 'abcdefgh' }, 0.5),
    ).toEqual({ city: 'Ca', days: [1, 2], note: 'abcd' });
  });

  it('does not truncate the items it keeps from a list', () => {
    expect(truncate(['abcd', 'efgh'], 0.5)).toEqual(['abcd']);
  });

  it('keeps everything with keep 1 and nothing with keep 0', () => {
    expect(truncate([1, 2, 3], 1)).toEqual([1, 2, 3]);
    expect(truncate('abc', 0)).toBe('');
  });

  it('leaves numbers, booleans and null alone', () => {
    expect(truncate(12345, 0.5)).toBe(12345);
    expect(truncate(false, 0.5)).toBe(false);
    expect(truncate(null, 0.5)).toBeNull();
  });
});

describe('the helpers never change their input', () => {
  it.each([
    ['blank', (value: JsonValue) => blank(value)],
    ['emptyLists', (value: JsonValue) => emptyLists(value)],
    ['truncate', (value: JsonValue) => truncate(value, 0.5)],
  ])('%s', (_name, helper) => {
    const value: JsonValue = { results: [{ id: 1 }, { id: 2 }], note: 'abcd' };
    const copy = structuredClone(value);

    helper(value);

    expect(value).toEqual(copy);
  });
});
