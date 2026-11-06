import { isJsonValue, type JsonValue } from '../core/faults/json-value.js';

export interface ResultPayload<Result> {
  decode(result: Result): JsonValue | undefined;
  encode(result: Result, value: JsonValue): Result;
}

export const jsonPayload: ResultPayload<unknown> = {
  decode: (result) => (isJsonValue(result) ? result : undefined),
  encode: (_result, value) => value,
};
