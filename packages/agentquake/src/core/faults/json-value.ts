export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

export function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isPlainObject(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

export function blank(value: JsonValue): JsonValue {
  if (typeof value === 'string') {
    return '';
  }
  if (Array.isArray(value)) {
    return [];
  }
  if (typeof value === 'object' && value !== null) {
    return {};
  }
  return value;
}

export function emptyLists(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return [];
  }
  if (typeof value === 'object' && value !== null) {
    return mapValues(value, emptyLists);
  }
  return value;
}

export function truncate(value: JsonValue, keep: number): JsonValue {
  if (typeof value === 'string' || Array.isArray(value)) {
    return value.slice(0, Math.floor(value.length * keep));
  }
  if (typeof value === 'object' && value !== null) {
    return mapValues(value, (inner) => truncate(inner, keep));
  }
  return value;
}

function mapValues(
  object: JsonObject,
  change: (value: JsonValue) => JsonValue,
): JsonObject {
  return Object.fromEntries(
    Object.entries(object).map(([key, inner]) => [key, change(inner)]),
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
