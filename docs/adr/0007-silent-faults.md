# ADR 0007: Silent faults that change a successful response

- Status: Accepted
- Date: 2026-11-06

## Context

The three faults so far (`latency`, `http_error`, `timeout`) all act before
the real tool is called, and two of them end in a clear error. An agent
sees that something went wrong.

The AgentChaos project (Python, ASE 2026) injected faults into LLM API
responses and found that omission faults, a successful response that is
empty or cut short, hurt agents more than crashes: crashes are noticed and
retried, while an empty or truncated answer looks valid and travels
silently through the agent. Truncation was correctly diagnosed in only
4.3% of cases. Their faults target the model's responses; we apply the same
idea to tool responses. That the result carries over is our assumption, and
these faults exist to test it.

Two new faults:

- `empty_response`: the tool answers, but with nothing. Mode `blank` (the
  default) empties the value (`[]`, `""`, `{}`); mode `no-results` keeps the
  shape and empties every list (`{ results: [...], total: 3 }` becomes
  `{ results: [], total: 3 }`), which looks like a normal answer.
- `truncated_response`: the tool answers with only the first part. Config
  `keep` (default 0.5) is the fraction kept.

Both need the real response, so they act after the call. Each transport
carries the response differently: the library has a JavaScript value, the
HTTP proxy has bytes, and MCP has `structuredContent` and a text copy that
is usually JSON inside a string.

## Decision

### Plugin interface

`FaultPlugin` gets an optional method:

```ts
corrupt?(value: JsonValue, config: Record<string, unknown>): JsonValue;
```

- `apply` still runs before the call. Silent faults return `continue` from
  it.
- `corrupt` is pure and synchronous, and returns a new value without
  changing its input.
- It only works on JSON values (strings, numbers, booleans, `null`, arrays
  and plain objects). Anything else is returned unchanged.
- Existing faults do not change.

Alternatives such as a new `{ kind: 'transform' }` outcome from `apply`
were rejected: they would put functions inside `FaultOutcome` and make
every reader of it more complex.

### Behavior

- `empty_response`, mode `blank`: strings become `""`, arrays `[]`, objects
  `{}`. Mode `no-results`: every array at any depth becomes `[]`, other
  values stay.
- `truncated_response`: strings and arrays keep their first
  `Math.floor(length * keep)` items; objects keep all their keys and are
  truncated inside, recursively. With `keep: 0.5`, a one-item array becomes
  empty. There is no randomness, so seeded replay stays exact. The result is
  always valid JSON: broken JSON is a separate fault (`malformed_body`), and
  dropping keys is another (`missing_fields`), both later.
- Config is validated with zod: `mode` is `blank` or `no-results`, `keep` is
  between 0 and 1.

### Applying faults after the call

`corruptResult(value, applied, registry)` in `core/faults/fault-runner.ts`
runs the `corrupt` method of every applied fault, in order, and returns the
new value and the ids of the faults that actually changed it:

```ts
{ value: JsonValue, corruptedBy: string[] }
```

Each adapter decodes the response to a JSON value, calls `corruptResult`,
and encodes the result back the way it came:

| Adapter    | Decode                                  | Encode                                     |
| ---------- | --------------------------------------- | ------------------------------------------ |
| Library    | The returned value, if it is JSON       | The value itself                           |
| HTTP proxy | JSON body, or text body as a string     | Same status and content type, new length   |
| MCP        | `structuredContent`, and each text item | Both changed the same way; `isError` stays |

An MCP text item that holds JSON is parsed, corrupted and serialized again;
other text is corrupted as a string. When an adapter cannot decode a
response (binary bodies, server-sent events), it leaves it alone.

### Traces stay honest

A silent fault is recorded in a call's `faults` only if it changed the
value (`corruptedBy`). Such a call keeps `ok: true`, because the agent saw
no error, and gets `corrupted: true`. A silent fault that matched but had
nothing to change (an already empty list, a binary body) is not recorded.

### The server

The NestJS server (level 3) does not run `corrupt` yet. Scenarios sent to
the server that use `empty_response` or `truncated_response` are rejected
with a message saying they work in the library and the CLI. Otherwise its
traces would list faults that never happened.

### Report

- `report.corruptedCalls`: the calls changed by a silent fault.
- `report.leakedGarbage`: `true` when at least one call was corrupted and
  the agent's answer contains `undefined`, `null`, `NaN` or
  `[object Object]`, the typical sign of an empty value turned into text.
  `null` when `run.agent` was not used.
- `falseSuccess` keeps its meaning (the agent claimed success after a
  visible failure) and does not count silent faults. An agent that answers
  "no flights found" to an emptied list reported what it saw; whether that
  is good behavior depends on the task, so it is left to the evaluators of
  phase 3.

### Preset

`silent`: `empty_response` (mode `no-results`) with probability 0.3 and
`truncated_response` (`keep` 0.5) with probability 0.3, on every tool.

## Alternatives considered

- **Count silent faults in `falseSuccess`**: one number to check, but it
  would change what `falseSuccess` means for existing users and flag agents
  that did nothing wrong with the data they got.
- **Implement the server adapters now**: complete, but the library and the
  CLI are where users start (ADR 0006); the server can follow.
- **Drop half of an object's keys when truncating**: simple, but that is a
  schema change, not a truncation, and would hide which of the two the agent
  fails on.

## Consequences

- A silent fault that cannot act leaves no trace, so `injectedFaults` can be
  lower than the number of matched rules. This is intended.
- Adapters gain a decode and encode step, tested per transport.
- `leakedGarbage` is a heuristic like the word list of `falseSuccess`, and
  is replaced by evaluators in phase 3.
- The README must present the research finding as being about model
  responses, and our use of it on tool responses as an assumption.
