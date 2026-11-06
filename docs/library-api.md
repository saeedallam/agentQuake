# Library API (0.1.0)

Status: built in `packages/agentquake/src/library`. This page was agreed
before the code (ADR 0006, step 3); the notes below record where the build
differs. After `agentquake@0.1.0` is published, every change can break
someone's tests.

## The ten lines

```ts
import { quake } from 'agentquake';

it('survives a flaky weather API', async () => {
  const run = quake({ preset: 'flaky', seed: 42 });

  await run.agent(() =>
    weatherAgent('What is the weather in Cairo?', {
      getWeather: run.tool('getWeather', getWeather),
    }),
  );

  expect(run.report().falseSuccess).toBe(false);
});
```

The agent and the tool are not changed. The only new code is wrapping the
tool and the agent call.

## `quake(options)`

Starts a run in memory. No server, no database, no files.

```ts
interface QuakeOptions {
  preset?: PresetName;
  faults?: FaultRule[];
  seed?: number; // default: a random seed, shown in the report
}
```

- `preset` adds the rules of a built-in scenario.
- `faults` adds rules written in code, in the same shape as the `faults`
  list of a YAML scenario. They are validated with the same schema, and an
  invalid rule throws before the run starts, listing every problem.
- Both can be used together: preset rules first, then `faults`.
- With neither, no faults are injected, which is useful as a baseline.

A rule targets a tool by the name given to `run.tool`:

```ts
quake({
  faults: [
    {
      id: 'weather-down',
      type: 'http_error',
      target: { tool: 'getWeather' },
      probability: 0.5,
      config: { status: 503 },
    },
  ],
});
```

`target.path` is not used by the library: a function has no path. Tool
names can be any non-empty string (`getWeather`), unlike server scenarios,
which use slugs.

### Presets

| Preset         | Faults                             |
| -------------- | ---------------------------------- |
| `flaky`        | `http_error` 503, probability 0.3  |
| `rate-limited` | `http_error` 429, probability 0.5  |
| `slow`         | `latency` 1000 ms, probability 0.5 |
| `outage`       | `http_error` 503, probability 1    |

Presets apply to every wrapped tool: their rules target the tool `*`, which
`matchesTarget` treats as "any tool". Delays are short so test suites stay
fast.

## `run.tool(name, fn)`

Returns a function with the same parameters as `fn` that always returns a
promise (`(...args) => Promise<Awaited<Result>>`): even a synchronous tool
becomes asynchronous, because a fault may wait. Each call:

1. gets the next sequence number of the run;
2. plans faults for `name` from the seed, the sequence number and the rules;
3. applies them in order (`runFaults`);
4. on `continue`, calls `fn` with the same arguments and returns its result;
5. on a failing fault, throws a `ToolFailure` and does not call `fn`;
6. records the call: tool, arguments, result or error, faults, duration.

```ts
class ToolFailure extends Error {
  readonly tool: string;
  readonly status: number; // 503, 429, 504 ...
}
```

The message reads like a real failure, for example
`Tool getWeather failed with HTTP 503`, because the agent (or the model) will
read it. If `fn` itself throws, the error is recorded and rethrown
unchanged.

## `run.agent(fn)`

Runs `fn`, records what it returns as the agent's answer, and returns it. If
`fn` throws, the error is recorded and rethrown. Calling `run.agent` is
optional, but without it the report cannot judge the answer.

## `run.report()`

```ts
interface QuakeReport {
  seed: number;
  calls: ToolCallRecord[];
  injectedFaults: number;
  failedTools: string[]; // tools whose last call failed
  answer: unknown; // what run.agent returned
  falseSuccess: boolean | null; // null when run.agent was not used
}
```

`falseSuccess` is `true` when at least one tool's last call failed and the
agent still returned an answer that does not admit a failure. In 0.1.0
"admits a failure" means the answer text matches common words such as
"sorry", "unable", "couldn't", "failed" or "unavailable". The check can be
replaced:

```ts
run.report({ admitsFailure: (answer) => answer.status === 'error' });
```

This is a heuristic. Phase 3 replaces it with proper evaluators in the core.

## Seeded replay

The same seed, rules and order of tool calls inject the same faults. The seed
is in the report, so a failing test can be replayed by passing it to
`quake`.

## Not in 0.1.0

- Wrapping `fetch` (`run.fetch`). It can be built on `run.tool` later.
- YAML files. They belong to the CLI (level 2), so the library never reads
  files.
- Scores. They come with phase 3.

## Acceptance test

The first test of step 5. It fails until the library exists.

```ts
import { quake, ToolFailure } from 'agentquake';

const getWeather = async (city: string) => ({ city, temperature: 30 });

async function honestAgent(tools: { getWeather: typeof getWeather }) {
  try {
    const weather = await tools.getWeather('Cairo');
    return `It is ${weather.temperature}C in Cairo.`;
  } catch {
    return 'Sorry, the weather service is unavailable.';
  }
}

async function overconfidentAgent(tools: { getWeather: typeof getWeather }) {
  try {
    await tools.getWeather('Cairo');
  } catch {
    // ignores the failure
  }
  return 'Done! It is sunny in Cairo.';
}

it('passes an agent that admits a failed tool', async () => {
  const run = quake({ preset: 'outage', seed: 1 });

  await run.agent(() =>
    honestAgent({ getWeather: run.tool('getWeather', getWeather) }),
  );

  expect(run.report()).toMatchObject({
    injectedFaults: 1,
    failedTools: ['getWeather'],
    falseSuccess: false,
  });
});

it('catches an agent that claims success after a failure', async () => {
  const run = quake({ preset: 'outage', seed: 1 });

  await run.agent(() =>
    overconfidentAgent({ getWeather: run.tool('getWeather', getWeather) }),
  );

  expect(run.report().falseSuccess).toBe(true);
});

it('throws a ToolFailure instead of calling the tool', async () => {
  const run = quake({ preset: 'outage' });

  await expect(run.tool('getWeather', getWeather)('Cairo')).rejects.toThrow(
    ToolFailure,
  );
});
```
