<p align="center">
  <img src="https://raw.githubusercontent.com/saeedallam/agentQuake/main/assets/logo-light.png" width="120" alt="agentQuake logo">
</p>

<h1 align="center">agentquake</h1>

<p align="center"><b>Chaos testing for AI agents, inside your tests.</b><br>
Make your agent's tools fail and see whether it copes, retries or lies about success.</p>

```bash
npm i -D agentquake
```

## Ten lines

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

Your agent and your tools do not change. `run.tool` wraps a tool function:
before each call it decides, from the seed, whether to inject a fault. A
failing fault throws a `ToolFailure` (`Tool getWeather failed with HTTP 503`)
instead of calling the real tool. `run.agent` keeps the agent's final answer,
and `run.report()` tells you what happened.

Works with Vitest, Jest or any test runner, with no server and no database.
The package is ESM only and needs Node.js 22.12 or newer.

## Presets

| Preset         | What happens to every wrapped tool                                        |
| -------------- | ------------------------------------------------------------------------- |
| `flaky`        | Fails with 503 in 30% of calls                                            |
| `rate-limited` | Fails with 429 in 50% of calls                                            |
| `slow`         | Waits 1 second in 50% of calls                                            |
| `outage`       | Fails with 503 on every call                                              |
| `silent`       | Answers 200, but empties the lists (30%) or cuts the answer in half (30%) |

## Your own faults

```ts
const run = quake({
  seed: 7,
  faults: [
    {
      id: 'email-down',
      type: 'http_error', // or latency, timeout, empty_response, truncated_response
      target: { tool: 'sendEmail' },
      probability: 0.5,
      config: { status: 503 },
    },
  ],
});
```

Invalid options throw a `QuakeConfigError` that lists every problem.

## The report

```ts
const report = run.report();

report.seed; // pass it to quake({ seed }) to replay the same faults
report.calls; // every tool call: arguments, faults, result or error
report.injectedFaults; // how many faults fired
report.failedTools; // tools whose last call failed
report.falseSuccess; // the agent claimed success after a tool failed
report.corruptedCalls; // calls whose answer a silent fault changed
report.leakedGarbage; // a silent fault fired and the answer shows undefined, null or NaN
```

`falseSuccess` is `true` when a tool's last call failed and the agent's
answer does not admit it (words such as "sorry", "unable", "failed",
"unavailable"). It is a heuristic; pass your own check when you know your
agent's output:

```ts
run.report({ admitsFailure: (answer) => answer.status === 'error' });
```

Two limits to know about:

- The default word list is English only. For an agent that answers in
  another language, pass your own `admitsFailure`.
- Only the last call of each tool counts. If a tool fails and the agent
  recovers by calling a different tool, the first tool still counts as
  failed. Marking the tools that matter is planned.

## Silent faults

Some failures do not look like failures: the tool answers 200, but the
answer is empty or cut short. Nothing throws, so an agent that does not
check what it got carries on as if all were fine.

| Fault                | What the agent gets                                     | Config                                      |
| -------------------- | ------------------------------------------------------- | ------------------------------------------- |
| `empty_response`     | `""`, `[]` or `{}`; with `no-results`, every list empty | `mode`: `blank` (default) or `no-results`   |
| `truncated_response` | The first part of every string and list                 | `keep`: fraction kept, 0 to 1 (default 0.5) |

```ts
const run = quake({
  faults: [
    { id: 'empty', type: 'empty_response', target: { tool: 'getWeather' } },
  ],
});

const answer = await run.agent(async () => {
  const weather = await run.tool('getWeather', getWeather)('Cairo');
  return `It is ${weather.temp} degrees`; // "It is undefined degrees"
});

run.report().leakedGarbage; // true
```

A silent fault is only counted when it actually changed the answer. Results
that are not plain JSON (a `Date`, a `Buffer`) are left alone. The proxy
changes JSON and text bodies, and `stdio` changes MCP `structuredContent`
and text content the same way; `isError` stays `false`.

Research on agents found that empty and truncated answers from the model
hurt more than crashes and are rarely diagnosed
([AgentChaos](https://floritange.github.io/AgentChaos/)). These faults
apply the same idea to tool answers.

## Same seed, same faults

Whether a fault fires depends only on the seed, the call number and the
fault id. A failing test prints its seed in the report, so you can replay it
exactly.

## Tools you do not call from code

When the agent talks to an HTTP API or starts an MCP server itself, there is
no function to wrap. The `agentquake` command stands in the middle instead,
with no server and no database. Every call is written to
`agentquake-traces.jsonl`.

### HTTP APIs: `agentquake proxy`

```bash
npx agentquake proxy --preset flaky --tool weather=https://api.weather.com
```

Point the agent at `http://127.0.0.1:4000/weather/...` instead of
`https://api.weather.com/...`. A failing fault answers with its status
(503, 429, 504) and the real API is not called. Use `--port` to change the
port and repeat `--tool` for more APIs.

### MCP servers over stdio: `agentquake stdio`

In the agent's MCP configuration, put `npx agentquake stdio [options] --`
in front of the server command:

```json
{
  "command": "npx",
  "args": [
    "agentquake",
    "stdio",
    "--preset",
    "flaky",
    "--",
    "node",
    "weather-server.js"
  ]
}
```

agentQuake starts the real server, passes every message through, and only
touches `tools/call`. A failing fault becomes a normal MCP tool result with
`isError: true` and the same `id`, so the model sees that the tool failed.

### Scenarios and reports

```bash
npx agentquake stdio --scenario chaos.yaml --seed 42 -- node server.js
npx agentquake report agentquake-traces.jsonl
```

A scenario file holds `faults` (the same rules as in code) and an optional
`seed`. For the proxy, `target.path` matches the request path
(`/forecast*`); for MCP, `target.tool` is the MCP tool name (`get_forecast`).

```yaml
seed: 42
faults:
  - id: forecast-down
    type: http_error
    target: { tool: get_forecast }
    probability: 0.5
    config: { status: 503 }
```

## More

The project also has a server for teams. See the
[repository](https://github.com/saeedallam/agentquake).

## License

Apache-2.0
